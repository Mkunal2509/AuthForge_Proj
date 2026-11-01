import sqlite3
import base64
from pathlib import Path
from typing import Optional, Dict, Any
import cv2
import numpy as np
import insightface
from insightface.app import FaceAnalysis

DB_FILE = str(Path(__file__).resolve().parent / "face_auth.db")

# Initialize InsightFace buffalo_s model (compact & fast)
face_app = FaceAnalysis(name="buffalo_s", providers=["CPUExecutionProvider"])
face_app.prepare(ctx_id=0, det_size=(320, 320))

def init_db():
    with sqlite3.connect(DB_FILE) as conn:
        conn.cursor().execute("""
            CREATE TABLE IF NOT EXISTS face_identities (
                user_id TEXT PRIMARY KEY,
                display_name TEXT NOT NULL,
                embedding_blob BLOB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()

init_db()

def decode_image(image_b64: str) -> np.ndarray:
    if "," in image_b64:
        image_b64 = image_b64.split(",")[1]
    raw = base64.b64decode(image_b64)
    arr = np.frombuffer(raw, dtype=np.uint8)
    return cv2.imdecode(arr, cv2.IMREAD_COLOR)

def get_face_vector(img: np.ndarray) -> Optional[np.ndarray]:
    faces = face_app.get(img)
    if not faces:
        return None
    # Pick largest face
    faces = sorted(faces, key=lambda f: (f.bbox[2]-f.bbox[0]) * (f.bbox[3]-f.bbox[1]), reverse=True)
    return faces[0].normed_embedding

def enroll_face(user_id: str, display_name: str, image_b64: str) -> Dict[str, Any]:
    img = decode_image(image_b64)
    emb = get_face_vector(img)
    if emb is None:
        raise ValueError("No visible face detected. Center face in front of the lens.")

    with sqlite3.connect(DB_FILE) as conn:
        conn.cursor().execute("""
            INSERT INTO face_identities (user_id, display_name, embedding_blob)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                display_name = excluded.display_name,
                embedding_blob = excluded.embedding_blob,
                created_at = CURRENT_TIMESTAMP
        """, (user_id, display_name, emb.tobytes()))
        conn.commit()

    return {"status": "success", "user_id": user_id, "display_name": display_name}

def recognize_candidate(image_b64: str, threshold: float = 0.42) -> Optional[Dict[str, Any]]:
    img = decode_image(image_b64)
    cand_emb = get_face_vector(img)
    if cand_emb is None:
        return None

    best = None
    min_dist = float("inf")

    with sqlite3.connect(DB_FILE) as conn:
        rows = conn.cursor().execute("SELECT user_id, display_name, embedding_blob FROM face_identities").fetchall()

    for uid, name, blob in rows:
        stored_emb = np.frombuffer(blob, dtype=np.float32)
        # Cosine distance = 1 - dot product (vectors are unit normalized)
        dist = float(1.0 - np.dot(cand_emb, stored_emb))
        if dist < min_dist:
            min_dist = dist
            best = {"user_id": uid, "name": name, "dist": dist}

    if best and best["dist"] <= threshold:
        confidence = max(0.0, min(100.0, (1.0 - best["dist"]) * 100.0))
        return {
            "authenticated": True,
            "user_id": best["user_id"],
            "name": best["name"],
            "confidence": round(confidence, 1)
        }

    return {"authenticated": False, "name": "Unknown Person", "confidence": 0.0}