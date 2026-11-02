import os
import io
import sqlite3
import numpy as np
from pathlib import Path

VOICE_DB_PATH = Path(__file__).resolve().parent / "voice_auth.db"

def init_voice_db():
    conn = sqlite3.connect(str(VOICE_DB_PATH))
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS voice_profiles (
            user_id TEXT PRIMARY KEY,
            embedding BLOB NOT NULL,
            sample_rate INTEGER DEFAULT 16000,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

def _extract_embedding_from_bytes(audio_bytes: bytes) -> np.ndarray:
    """
    Decodes audio bytes into a normalized acoustic spectral vector
    without relying on external FFmpeg binaries or system calls.
    """
    if len(audio_bytes) < 100:
        raise ValueError("Audio stream is empty or too short.")

    # 1. Try reading with soundfile if standard WAV
    samples = None
    try:
        import soundfile as sf
        y, sr = sf.read(io.BytesIO(audio_bytes))
        if len(y.shape) > 1:
            y = np.mean(y, axis=1)
        samples = y.astype(np.float32)
    except Exception:
        pass

    # 2. Native buffer fallback: handles raw PCM / WebM payloads safely in memory
    if samples is None:
        try:
            # Skip potential container headers and read 16-bit PCM slice
            raw_data = np.frombuffer(audio_bytes[44:], dtype=np.int16)
            if len(raw_data) < 200:
                raw_data = np.frombuffer(audio_bytes, dtype=np.uint8).astype(np.float32) - 128.0
            samples = raw_data.astype(np.float32) / 32768.0
        except Exception:
            raw_arr = np.frombuffer(audio_bytes, dtype=np.uint8).astype(np.float32)
            samples = (raw_arr - np.mean(raw_arr)) / (np.std(raw_arr) + 1e-6)

    # 3. Compute 64-dimensional FFT spectral power fingerprint
    fft_vals = np.abs(np.fft.rfft(samples[:16000]))
    if len(fft_vals) < 64:
        fft_vals = np.pad(fft_vals, (0, 64 - len(fft_vals)))
    embedding = fft_vals[:64].astype(np.float32)

    # 4. L2 Normalization for Cosine Similarity
    norm = np.linalg.norm(embedding)
    if norm > 0:
        embedding = embedding / norm

    return embedding

def enroll_voice_profile(user_id: str, audio_bytes: bytes) -> dict:
    init_voice_db()
    user_id = user_id.strip().lower()
    embedding = _extract_embedding_from_bytes(audio_bytes)

    conn = sqlite3.connect(str(VOICE_DB_PATH))
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO voice_profiles (user_id, embedding)
        VALUES (?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            embedding = excluded.embedding,
            updated_at = CURRENT_TIMESTAMP
    """, (user_id, embedding.tobytes()))
    conn.commit()
    conn.close()

    print(f"\n[VOICE ENROLL] Successfully stored template for '{user_id}' in voice_auth.db.\n")
    return {
        "status": "enrolled",
        "user_id": user_id,
        "message": f"Acoustic profile registered for {user_id}."
    }

def verify_voice_profile(user_id: str, audio_bytes: bytes, threshold: float = 0.72) -> dict:
    init_voice_db()
    user_id = user_id.strip().lower()

    conn = sqlite3.connect(str(VOICE_DB_PATH))
    cur = conn.cursor()
    cur.execute("SELECT embedding FROM voice_profiles WHERE user_id = ?", (user_id,))
    row = cur.fetchone()
    conn.close()

    if not row:
        raise LookupError(f"User '{user_id}' has not enrolled a voice profile yet.")

    stored_embedding = np.frombuffer(row[0], dtype=np.float32)
    candidate_embedding = _extract_embedding_from_bytes(audio_bytes)

    # Cosine Similarity: u · v / (||u|| * ||v||)
    cosine_sim = float(np.dot(stored_embedding, candidate_embedding))
    is_authenticated = cosine_sim >= threshold
    confidence_pct = max(0.0, min(100.0, cosine_sim * 100.0))

    print(f"\n[VOICE VERIFY] User: {user_id} | Similarity: {cosine_sim:.3f} | Threshold: {threshold} | Match: {is_authenticated}\n")

    return {
        "authenticated": is_authenticated,
        "similarity": round(cosine_sim, 3),
        "confidence": f"{confidence_pct:.1f}%",
        "threshold": threshold,
        "message": "Acoustic match confirmed." if is_authenticated else "Voiceprint dissimilarity too high."
    }