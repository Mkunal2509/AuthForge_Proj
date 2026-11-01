from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from face_engine import enroll_face, recognize_candidate

app = FastAPI(title="AuthForge Face Recognition Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class EnrollPayload(BaseModel):
    user_id: str
    display_name: str
    image_base64: str

class RecognizePayload(BaseModel):
    image_base64: str

@app.post("/api/v1/face/enroll")
def enroll(payload: EnrollPayload):
    try:
        return enroll_face(payload.user_id, payload.display_name, payload.image_base64)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/v1/face/recognize")
def recognize(payload: RecognizePayload):
    res = recognize_candidate(payload.image_base64)
    if res is None:
        return {"detected": False, "authenticated": False, "name": "Searching..."}
    return {"detected": True, **res}