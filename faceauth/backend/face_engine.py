import base64
import json
import sqlite3
import numpy as np
import cv2
from pathlib import Path
from typing import Optional, Dict, Any

CURRENT_DIR = Path(__file__).resolve().parent
DB_PATH = CURRENT_DIR / "face_auth.db"

# ------------------------------------------------------------------------------
# Try loading InsightFace / ArcFace neural network; fallback to Enhanced LBP/HOG
# ------------------------------------------------------------------------------
FACE_APP = None
try:
    from insightface.app import FaceAnalysis
    app = FaceAnalysis(name="buffalo_s", providers=["CPUExecutionProvider"])
    app.prepare(ctx_id=0, det_size=(320, 320))
    FACE_APP = app
    print("\n[FACE ENGINE] InsightFace / ArcFace neural network active.\n")
except Exception as e:
    print(f"\n[FACE ENGINE] Notice: InsightFace neural model not active ({e}). Using Enhanced 256-D Illumination-Invariant Descriptor.\n")

def _init_face_db():
    conn = sqlite3.connect(str(DB_PATH))
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS face_templates (
            user_id TEXT PRIMARY KEY,
            display_name TEXT NOT NULL,
            embedding_json TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

_init_face_db()

def _decode_image(base64_str: str) -> Optional[np.ndarray]:
    try:
        if "," in base64_str:
            base64_str = base64_str.split(",", 1)[1]
        img_bytes = base64.b64decode(base64_str)
        np_arr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        return img
    except Exception as e:
        print(f"[FACE ENGINE] Image decode error: {e}")
        return None

def _extract_enhanced_features(img: np.ndarray) -> Optional[np.ndarray]:
    if img is None:
        return None

    # Option A: True ArcFace / InsightFace Neural Vector (512-D)
    if FACE_APP is not None:
        try:
            faces = FACE_APP.get(img)
            if faces and len(faces) > 0:
                largest = max(faces, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
                normed = largest.normed_embedding
                if normed is not None:
                    return np.array(normed, dtype=np.float32)
        except Exception as e:
            print(f"[FACE ENGINE] Neural inference error: {e}")

    # Option B: Advanced Illumination-Normalized 256-D Spatial Gradient Descriptor
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape

    cascade_path = getattr(cv2.data, 'haarcascades', '') + "haarcascade_frontalface_default.xml"
    face_roi = None

    if Path(cascade_path).exists():
        classifier = cv2.CascadeClassifier(cascade_path)
        faces = classifier.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(80, 80)
        )
        if len(faces) > 0:
            fx, fy, fw, fh = max(faces, key=lambda f: f[2] * f[3])
            pad_x = int(fw * 0.1)
            pad_y = int(fh * 0.1)
            x1, y1 = max(0, fx - pad_x), max(0, fy - pad_y)
            x2, y2 = min(w, fx + fw + pad_x), min(h, fy + fh + pad_y)
            face_roi = gray[y1:y2, x1:x2]

    if face_roi is None:
        cy, cx = h // 2, w // 2
        box_h, box_w = int(h * 0.55), int(w * 0.45)
        face_roi = gray[max(0, cy - box_h//2):min(h, cy + box_h//2), max(0, cx - box_w//2):min(w, cx + box_w//2)]

    resized = cv2.resize(face_roi, (128, 128))
    filtered = cv2.bilateralFilter(resized, 9, 75, 75)
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8, 8))
    equalized = clahe.apply(filtered)

    gx = cv2.Sobel(equalized, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(equalized, cv2.CV_32F, 0, 1, ksize=3)
    mag, ang = cv2.cartToPolar(gx, gy, angleInDegrees=True)

    cell_h, cell_w = 32, 32
    histograms = []
    for r in range(4):
        for c in range(4):
            cell_mag = mag[r*cell_h:(r+1)*cell_h, c*cell_w:(c+1)*cell_w]
            cell_ang = ang[r*cell_h:(r+1)*cell_h, c*cell_w:(c+1)*cell_w]
            hist, _ = np.histogram(cell_ang, bins=16, range=(0, 360), weights=cell_mag)
            histograms.extend(hist)

    feature_vec = np.array(histograms, dtype=np.float32)
    norm = np.linalg.norm(feature_vec)
    if norm > 1e-6:
        feature_vec = feature_vec / norm

    return feature_vec

def enroll_face(user_id: str, display_name: str, image_base64: str) -> Dict[str, Any]:
    img = _decode_image(image_base64)
    if img is None:
        raise ValueError("Invalid frame payload received.")

    emb = _extract_enhanced_features(img)
    if emb is None:
        raise ValueError("No visible face detected. Center face in front of the camera.")

    conn = sqlite3.connect(str(DB_PATH))
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO face_templates (user_id, display_name, embedding_json)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            display_name = excluded.display_name,
            embedding_json = excluded.embedding_json,
            created_at = CURRENT_TIMESTAMP
    """, (user_id, display_name, json.dumps(emb.tolist())))
    conn.commit()
    conn.close()

    print(f"\n[FACE ENGINE] Registered fresh {len(emb)}-D master profile for '{display_name}' ({user_id})\n")
    return {"status": "enrolled", "user_id": user_id, "message": f"Face vector registered for {display_name}"}

def recognize_candidate(image_base64: str) -> Dict[str, Any]:
    img = _decode_image(image_base64)
    if img is None:
        return {"detected": False, "authenticated": False, "name": "Awaiting camera..."}

    cand_vec = _extract_enhanced_features(img)
    if cand_vec is None:
        return {"detected": False, "authenticated": False, "name": "Searching for face..."}

    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT user_id, display_name, embedding_json FROM face_templates")
    rows = cur.fetchall()
    conn.close()

    if not rows:
        return {"detected": True, "authenticated": False, "name": "Unregistered (Enroll First)", "confidence": 0.0}

    best_similarity = -1.0
    best_match = None

    for row in rows:
        try:
            stored_list = json.loads(row["embedding_json"])
            # Guard against mismatched legacy vectors (e.g. 4096-D vs 256-D)
            if len(stored_list) != len(cand_vec):
                continue
            stored_vec = np.array(stored_list, dtype=np.float32)
            similarity = float(np.dot(cand_vec, stored_vec))
            if similarity > best_similarity:
                best_similarity = similarity
                best_match = row
        except Exception:
            continue

    if best_match is None:
        return {"detected": True, "authenticated": False, "name": "Legacy template incompatible. Please re-enroll.", "confidence": 0.0}

    threshold = 0.50 if FACE_APP is not None else 0.72
    is_authenticated = bool(best_similarity >= threshold)

    confidence = max(0.0, min(100.0, (best_similarity ** 2) * 100.0))

    if is_authenticated and best_match:
        return {
            "detected": True,
            "authenticated": True,
            "user_id": best_match["user_id"],
            "name": f"{best_match['display_name']} ({int(confidence)}%)",
            "confidence": round(confidence, 1)
        }

    return {
        "detected": True,
        "authenticated": False,
        "name": "Scanning...",
        "confidence": round(max(0.0, best_similarity * 100), 1)
    }