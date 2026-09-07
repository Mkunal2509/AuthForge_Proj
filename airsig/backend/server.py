import sys
from pathlib import Path
from typing import List, Tuple
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

current_dir = Path(__file__).resolve().parent
if str(current_dir) not in sys.path:
    sys.path.insert(0, str(current_dir))

try:
    from security import SecureBiometricVault, match_against_fused_template
except ImportError:
    from backend.security import SecureBiometricVault, match_against_fused_template

app = FastAPI(title="AuthForge Air-Signature Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

vault = SecureBiometricVault()

class SignaturePass(BaseModel):
    points: List[Tuple[float, float]]
    kinematics: List[List[float]] = []

class FusedEnrollRequest(BaseModel):
    user_id: str
    passes: List[SignaturePass]

class VerifyRequest(BaseModel):
    user_id: str
    points: List[Tuple[float, float]]
    kinematics: List[List[float]] = []

@app.post("/api/v1/airsig/enroll-fused")
def enroll_fused_signature(payload: FusedEnrollRequest):
    if len(payload.passes) != 3:
        raise HTTPException(status_code=400, detail="Exactly 3 enrollment passes required for DBA template fusion.")

    try:
        raw_passes = [{"points": p.points, "kinematics": p.kinematics} for p in payload.passes]
        vault.save_fused_template(payload.user_id, raw_passes)
        return {
            "status": "success",
            "message": f"Successfully synthesized and encrypted 3-pass master template for '{payload.user_id}'."
        }
    except Exception as err:
        raise HTTPException(status_code=400, detail=str(err))

@app.post("/api/v1/airsig/verify")
def verify_signature(payload: VerifyRequest):
    try:
        stored = vault.load_fused_template(payload.user_id)
    except LookupError as err:
        raise HTTPException(status_code=404, detail=str(err))
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Decryption failure: {str(err)}")

    try:
        is_auth, total_cost, shape_cost, behav_cost, confidence = match_against_fused_template(
            cand_points=payload.points,
            cand_kinematics=payload.kinematics,
            stored=stored,
            threshold=16.5
        )
        return {
            "authenticated": is_auth,
            "dtw_distance": total_cost,
            "shape_distance": shape_cost,
            "behavioral_distance": behav_cost,
            "threshold": 16.5,
            "confidence_score": f"{confidence}%"
        }
    except Exception as err:
        raise HTTPException(status_code=400, detail=str(err))