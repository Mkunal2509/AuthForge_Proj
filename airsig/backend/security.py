import os
import json
import sqlite3
import numpy as np
from pathlib import Path
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

DB_PATH = Path(__file__).resolve().parent / "authforge_secure.db"
VAULT_KEY_PATH = Path(__file__).resolve().parent / "vault.key"
RESAMPLE_N = 64

def _get_or_create_key() -> bytes:
    if VAULT_KEY_PATH.exists():
        return VAULT_KEY_PATH.read_bytes()
    key = AESGCM.generate_key(bit_length=256)
    VAULT_KEY_PATH.write_bytes(key)
    return key

def resample_and_normalize(points: list) -> np.ndarray:
    pts = np.array(points, dtype=np.float64)
    if len(pts) < 5:
        raise ValueError("Signature gesture too short.")

    # Remove consecutive micro-duplicate points
    diffs = np.diff(pts[:, :2], axis=0)
    seg_lengths = np.hypot(diffs[:, 0], diffs[:, 1])
    keep = np.concatenate(([True], seg_lengths > 1e-4))
    pts = pts[keep]

    if len(pts) < 5:
        raise ValueError("Signature lacks dynamic movement.")

    # Uniform Arc-Length Resampling
    diffs = np.diff(pts[:, :2], axis=0)
    seg_lengths = np.hypot(diffs[:, 0], diffs[:, 1])
    cum_dist = np.concatenate(([0.0], np.cumsum(seg_lengths)))
    total_len = cum_dist[-1]

    if total_len <= 0.001:
        raise ValueError("Static point detected.")

    target_dists = np.linspace(0, total_len, RESAMPLE_N)
    x_interp = np.interp(target_dists, cum_dist, pts[:, 0])
    y_interp = np.interp(target_dists, cum_dist, pts[:, 1])
    resampled = np.column_stack((x_interp, y_interp))

    # Center of mass translation
    centroid = np.mean(resampled, axis=0)
    centered = resampled - centroid

    # Scale normalization preserving aspect ratio
    span = np.max(np.ptp(centered, axis=0))
    if span < 1e-5:
        span = 1.0
    normalized_xy = centered / span

    # Tangent vector extraction
    grad = np.gradient(normalized_xy, axis=0)
    norms = np.hypot(grad[:, 0], grad[:, 1])
    norms[norms < 1e-6] = 1.0
    tx = grad[:, 0] / norms
    ty = grad[:, 1] / norms

    return np.column_stack((normalized_xy, tx * 0.35, ty * 0.35))

def extract_kinematics_vector(kinematics: list, points: list) -> np.ndarray:
    pts = np.array(points, dtype=np.float64)
    diffs = np.diff(pts[:, :2], axis=0)
    speeds = np.hypot(diffs[:, 0], diffs[:, 1])
    if len(speeds) == 0:
        return np.zeros(6, dtype=np.float64)

    s_mean = np.mean(speeds) + 1e-6
    s_norm = speeds / s_mean

    aspect = (np.ptp(pts[:, 0]) + 1e-4) / (np.ptp(pts[:, 1]) + 1e-4)
    aspect_norm = np.clip(aspect, 0.2, 5.0) / 5.0

    return np.array([
        np.std(s_norm),
        np.percentile(s_norm, 85),
        np.percentile(s_norm, 15),
        aspect_norm,
        float(len(pts)) / 200.0,
        np.sum(speeds) / 1000.0
    ], dtype=np.float64)

def constrained_dtw(seq1: np.ndarray, seq2: np.ndarray, window: int = 14):
    n, m = len(seq1), len(seq2)
    w = max(window, abs(n - m))
    dtw = np.full((n + 1, m + 1), np.inf)
    dtw[0, 0] = 0.0

    for i in range(1, n + 1):
        j_start = max(1, i - w)
        j_end = min(m + 1, i + w + 1)
        for j in range(j_start, j_end):
            cost = np.linalg.norm(seq1[i - 1] - seq2[j - 1])
            dtw[i, j] = cost + min(dtw[i - 1, j], dtw[i, j - 1], dtw[i - 1, j - 1])

    path = []
    i, j = n, m
    while i > 0 and j > 0:
        path.append((i - 1, j - 1))
        steps = [dtw[i - 1, j - 1], dtw[i - 1, j], dtw[i, j - 1]]
        idx = int(np.argmin(steps))
        if idx == 0:
            i, j = i - 1, j - 1
        elif idx == 1:
            i -= 1
        else:
            j -= 1
    path.reverse()
    return dtw[n, m] / max(len(path), 1), path

def dba_synthesize(sequences: list, iterations: int = 6) -> np.ndarray:
    center = np.copy(sequences[0])
    n_pts, n_dims = center.shape

    for _ in range(iterations):
        assoc = [[] for _ in range(n_pts)]
        for seq in sequences:
            _, path = constrained_dtw(center, seq)
            for c_idx, s_idx in path:
                assoc[c_idx].append(seq[s_idx])
        for k in range(n_pts):
            if assoc[k]:
                center[k] = np.mean(assoc[k], axis=0)
    return center

class SecureBiometricVault:
    def __init__(self):
        self.key = _get_or_create_key()
        self.aesgcm = AESGCM(self.key)
        self._init_table()

    def _init_table(self):
        conn = sqlite3.connect(str(DB_PATH))
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS airsig_vault (
                user_id TEXT PRIMARY KEY,
                nonce BLOB NOT NULL,
                ciphertext BLOB NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()
        conn.close()

    def save_fused_template(self, user_id: str, passes: list):
        norm_seqs = [resample_and_normalize(p["points"]) for p in passes]
        kin_vecs = [extract_kinematics_vector(p.get("kinematics", []), p["points"]) for p in passes]

        master_shape = dba_synthesize(norm_seqs, iterations=6)
        master_kin = np.mean(kin_vecs, axis=0)

        payload = json.dumps({
            "master_shape": master_shape.tolist(),
            "master_kinematics": master_kin.tolist()
        }).encode("utf-8")

        nonce = os.urandom(12)
        aad = user_id.encode("utf-8")
        ct = self.aesgcm.encrypt(nonce, payload, aad)

        conn = sqlite3.connect(str(DB_PATH))
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO airsig_vault (user_id, nonce, ciphertext)
            VALUES (?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                nonce = excluded.nonce,
                ciphertext = excluded.ciphertext,
                updated_at = CURRENT_TIMESTAMP
        """, (user_id, nonce, ct))
        conn.commit()
        conn.close()

    def load_fused_template(self, user_id: str) -> dict:
        conn = sqlite3.connect(str(DB_PATH))
        cur = conn.cursor()
        cur.execute("SELECT nonce, ciphertext FROM airsig_vault WHERE user_id = ?", (user_id,))
        row = cur.fetchone()
        conn.close()
        if not row:
            raise LookupError(f"No Air-Signature enrolled for '{user_id}'. Please complete enrollment first.")

        nonce, ct = row
        pt = self.aesgcm.decrypt(nonce, ct, user_id.encode("utf-8"))
        data = json.loads(pt.decode("utf-8"))
        return {
            "master_shape": np.array(data["master_shape"], dtype=np.float64),
            "master_kinematics": np.array(data["master_kinematics"], dtype=np.float64)
        }

def match_against_fused_template(cand_points: list, cand_kinematics: list, stored: dict, threshold: float = 0.20):
    cand_shape = resample_and_normalize(cand_points)
    cand_kin = extract_kinematics_vector(cand_kinematics, cand_points)

    shape_cost, _ = constrained_dtw(cand_shape, stored["master_shape"])
    behav_cost = float(np.linalg.norm(cand_kin - stored["master_kinematics"])) * 0.15

    total_cost = 0.85 * shape_cost + 0.15 * behav_cost
    is_auth = bool(total_cost <= threshold)

    confidence = max(0.0, min(100.0, (1.0 - (total_cost / (threshold * 1.8))) * 100.0))
    return is_auth, float(total_cost), float(shape_cost), float(behav_cost), round(confidence, 1)