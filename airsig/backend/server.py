import sys
from pathlib import Path
from typing import List, Tuple, Dict, Any, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

current_dir = Path(__file__).resolve().parent
if str(current_dir) not in sys.path:
    sys.path.insert(0, str(current_dir))

from security import SecureBiometricVault, match_against_fused_template

app = FastAPI(title="AuthForge Air-Signature Engine")

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
    client_id: Optional[str] = "default"
    user_id: str
    passes: List[SignaturePass]

class VerifyRequest(BaseModel):
    client_id: Optional[str] = "default"
    user_id: str
    points: List[Tuple[float, float]]
    kinematics: List[List[float]] = []

@app.post("/api/v1/airsig/enroll-fused")
def enroll_fused(payload: FusedEnrollRequest):
    if len(payload.passes) != 3:
        raise HTTPException(status_code=400, detail="3-Pass enrollment requires exactly 3 completed signatures.")

    raw_passes = [{"points": p.points, "kinematics": p.kinematics} for p in payload.passes]
    try:
        vault.save_fused_template(payload.user_id, raw_passes)
        return {
            "status": "success",
            "message": f"Biometric master template synthesized and vaulted for '{payload.user_id}'."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/airsig/verify")
def verify_airsig(payload: VerifyRequest):
    try:
        stored = vault.load_fused_template(payload.user_id)
    except LookupError:
        raise HTTPException(status_code=404, detail=f"User '{payload.user_id}' has not enrolled.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Vault decryption error: {str(e)}")

    try:
        is_authenticated, fused_cost, shape_dist, behavior_dist, confidence = match_against_fused_template(
            cand_points=payload.points,
            cand_kinematics=payload.kinematics,
            stored=stored,
            threshold=0.17
        )

        return {
            "authenticated": is_authenticated,
            "confidence_score": f"{confidence}%",
            "dtw_distance": fused_cost,
            "threshold": 0.17,
            "shape_distance": shape_dist,
            "behavioral_distance": behavior_dist
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Biometric matching failure: {str(e)}")