import sys
import os
import json
import secrets
import time
from pathlib import Path
from typing import List, Tuple, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Form, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ----------------- CLEAN SYS.PATH RESOLUTION -----------------
# Resolves module paths and ensures airsig/backend is prioritized
# to prevent module shadowing from voiceauth/database.py
CURRENT_FILE = Path(__file__).resolve()
BACKEND_DIR = CURRENT_FILE.parent                # airsig/backend
ROOT_DIR = CURRENT_FILE.parents[2]               # Authforge root
CORE_AUTH = ROOT_DIR / "core_auth"
FACE_BACKEND = ROOT_DIR / "faceauth" / "backend"
VOICE_BACKEND = ROOT_DIR / "voiceauth"

# Force airsig/backend to the very top of sys.path
if str(BACKEND_DIR) in sys.path:
    sys.path.remove(str(BACKEND_DIR))
sys.path.insert(0, str(BACKEND_DIR))

# Append external factor directories to sys.path
for p in [ROOT_DIR, CORE_AUTH, FACE_BACKEND, VOICE_BACKEND]:
    str_p = str(p)
    if str_p not in sys.path and p.exists():
        sys.path.append(str_p)

# Import local database and security modules
from database import init_db, get_connection
from auth_service import mint_session_token

try:
    from core_auth.password_engine import hash_password, verify_password
    from core_auth.otp_engine import issue_otp, verify_otp, issue_phone_otp, verify_phone_otp
except ModuleNotFoundError:
    from password_engine import hash_password, verify_password
    from otp_engine import issue_otp, verify_otp, issue_phone_otp, verify_phone_otp

from security import SecureBiometricVault, match_against_fused_template
from face_engine import enroll_face, recognize_candidate

# Initialize encrypted biometric vault and SQLite tables
vault = SecureBiometricVault()
init_db()

app = FastAPI(title="AuthForge Integrated Gateway")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------------------
# Request Schemas
# -------------------------------------------------------------
class AirSigVerifyPayload(BaseModel):
    client_id: Optional[str] = "default"
    user_id: str
    points: List[Tuple[float, float]]
    kinematics: Optional[List[List[float]]] = []

class FusedEnrollPayload(BaseModel):
    client_id: Optional[str] = "default"
    user_id: str
    passes: List[Dict[str, Any]]

class UniversalOTPRequest(BaseModel):
    target: Optional[str] = None
    phone_number: Optional[str] = None
    channel: str = "sms"

class UniversalOTPVerify(BaseModel):
    target: Optional[str] = None
    phone_number: Optional[str] = None
    otp_code: str

class TenantProvisionPayload(BaseModel):
    app_name: str
    primary_factor: str
    stepup_factor: str
    threshold_accept: float
    threshold_challenge: float

# -------------------------------------------------------------
# Health Check Endpoint
# -------------------------------------------------------------
@app.get("/")
def health_check():
    return {"status": "online", "gateway": "AuthForge Multi-Modal"}

# -------------------------------------------------------------
# 1. Kinematic Air-Signature Endpoints
# -------------------------------------------------------------
@app.post("/api/v1/airsig/enroll-fused")
def enroll_fused(payload: FusedEnrollPayload):
    user_id = payload.user_id.strip().lower()
    if len(payload.passes) != 3:
        raise HTTPException(status_code=400, detail="Exactly 3 passes are required.")
    raw_passes = [{"points": p["points"], "kinematics": p.get("kinematics", [])} for p in payload.passes]
    vault.save_fused_template(user_id, raw_passes)
    print(f"\n[AIRSIG] Master 3-Pass DBA template synthesized for user '{user_id}'.\n")
    return {"status": "success", "message": f"3-pass master template synthesized for '{user_id}'."}

@app.post("/api/v1/airsig/verify")
def verify_airsig(payload: AirSigVerifyPayload):
    user_id = payload.user_id.strip().lower()
    if not payload.points or len(payload.points) < 12:
        raise HTTPException(status_code=400, detail="Signature trajectory too short. Sign a continuous stroke.")

    try:
        stored = vault.load_fused_template(user_id)
    except LookupError:
        raise HTTPException(
            status_code=404,
            detail=f"User '{user_id}' has not enrolled an Air-Signature yet. Click 'Start 3-Pass Signature Enrollment' first."
        )

    is_auth, total_cost, shape_cost, behav_cost, conf = match_against_fused_template(
        cand_points=payload.points,
        cand_kinematics=payload.kinematics or [],
        stored=stored,
        threshold=0.22
    )

    token = mint_session_token(user_id, "user") if is_auth else None
    print(f"\n[AIRSIG VERIFY] User: {user_id} | Authenticated: {is_auth} | Cost: {round(total_cost, 3)} | Conf: {conf}%")

    return {
        "authenticated": is_auth,
        "dtw_cost": round(total_cost, 3),
        "confidence": f"{conf}%",
        "session_token": token,
        "message": "Access Approved" if is_auth else "Gesture distance exceeds matching threshold."
    }

# -------------------------------------------------------------
# 2. Password Verification Endpoints (Argon2id)
# -------------------------------------------------------------
@app.post("/api/v1/auth/step1-password")
def step1_password(payload: Dict[str, str]):
    user_id = str(payload.get("user_id", "")).strip().lower()
    pwd = str(payload.get("password", "")).strip()

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT user_id, password_hash, role FROM users WHERE LOWER(user_id) = ?", (user_id,))
    row = cur.fetchone()
    conn.close()

    if not row or not verify_password(row["password_hash"], pwd):
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    return {
        "status": "APPROVED",
        "step": 1,
        "user_id": row["user_id"],
        "message": f"Password verified for {row['user_id']}."
    }

@app.post("/api/v1/auth/login-password")
def login_password_endpoint(payload: Dict[str, str]):
    return step1_password(payload)

# -------------------------------------------------------------
# 3. Dynamic OTP Endpoints (Twilio / Terminal Fallback)
# -------------------------------------------------------------
@app.post("/api/v1/auth/otp/send")
def send_otp_endpoint(payload: UniversalOTPRequest):
    identifier = payload.target or payload.phone_number
    if not identifier:
        raise HTTPException(status_code=400, detail="Target phone number or email is required.")
    return issue_otp(identifier, channel=payload.channel)

@app.post("/api/v1/auth/otp/verify")
def verify_otp_endpoint(payload: UniversalOTPVerify):
    identifier = payload.target or payload.phone_number
    if not identifier:
        raise HTTPException(status_code=400, detail="Target phone number or email is required.")
    if not verify_otp(identifier, payload.otp_code):
        raise HTTPException(status_code=400, detail="Verification failed: Code is incorrect or expired.")

    token = mint_session_token(identifier, "user")
    return {"decision": "AUTHENTICATED", "user_id": identifier, "session_token": token}

# -------------------------------------------------------------
# 4. Facial Biometrics Endpoints
# -------------------------------------------------------------
@app.post("/api/v1/face/enroll")
def enroll_face_endpoint(payload: Dict[str, str]):
    user_id = payload["user_id"].strip().lower()
    return enroll_face(user_id, payload.get("display_name", user_id), payload["image_base64"])

@app.post("/api/v1/face/recognize")
def recognize_face_endpoint(payload: Dict[str, str]):
    return recognize_candidate(payload.get("image_base64", ""))

# -------------------------------------------------------------
# 5. Voice Biometric Endpoints
# -------------------------------------------------------------
@app.post("/api/v1/voice/enroll")
async def voice_enroll_endpoint(user_id: str = Form(...), audio: UploadFile = File(...)):
    user_clean = user_id.strip().lower()
    audio_bytes = await audio.read()

    try:
        from voice_engine import enroll_voice_profile
        return enroll_voice_profile(user_id=user_clean, audio_bytes=audio_bytes)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Voice enrollment failed: {str(e)}")

@app.post("/api/v1/voice/verify")
async def voice_verify_endpoint(user_id: str = Form(...), audio: UploadFile = File(...)):
    user_clean = user_id.strip().lower()
    audio_bytes = await audio.read()

    try:
        from voice_engine import verify_voice_profile
        res = verify_voice_profile(user_id=user_clean, audio_bytes=audio_bytes, threshold=0.72)
        if res["authenticated"]:
            res["session_token"] = mint_session_token(user_clean, "user")
        return res
    except LookupError as le:
        raise HTTPException(status_code=404, detail=str(le))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Voice verification failed: {str(e)}")

# -------------------------------------------------------------
# 6. Drop-in Banking Modal 3-Step Sequence Endpoints
# -------------------------------------------------------------
@app.post("/api/v1/auth/step2-face")
def step2_face(payload: Dict[str, str]):
    rec = recognize_candidate(payload.get("image_base64", ""))
    if not rec or not rec.get("authenticated"):
        raise HTTPException(status_code=401, detail="Facial biometric mismatch.")
    return {"status": "APPROVED", "confidence": rec.get("confidence", 94)}

@app.post("/api/v1/auth/step3-airsig")
def step3_airsig(payload: AirSigVerifyPayload):
    return verify_airsig(payload)

# -------------------------------------------------------------
# 7. Tenant Policy Orchestrator
# -------------------------------------------------------------
@app.post("/api/v1/developer/tenants")
def provision_tenant(payload: TenantProvisionPayload):
    client_id = f"client_{secrets.token_hex(6)}"
    api_key = f"sk_{secrets.token_hex(16)}"
    policy_dict = {
        "primary": payload.primary_factor,
        "stepup": payload.stepup_factor,
        "threshold_accept": payload.threshold_accept,
        "threshold_challenge": payload.threshold_challenge
    }

    conn = get_connection()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO tenants (client_id, api_key, app_name, policy)
        VALUES (?, ?, ?, ?)
    """, (client_id, api_key, payload.app_name, json.dumps(policy_dict)))
    conn.commit()
    conn.close()

    return {"client_id": client_id, "api_key": api_key, "app_name": payload.app_name}