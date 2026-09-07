import os
import json
import sqlite3
from pathlib import Path
from typing import List, Tuple, Dict, Any, Optional
import numpy as np
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# Database file location inside the backend directory
DB_FILE = str(Path(__file__).resolve().parent / "authforge_secure.db")

# =====================================================================
# 1. SPATIAL NORMALIZATION & KINEMATIC FEATURE EXTRACTION
# =====================================================================

def resample_trajectory(pts: np.ndarray, target_n: int = 64) -> np.ndarray:
    """Resamples a variable-speed trajectory into target_n equidistant arc points."""
    deltas = np.diff(pts, axis=0)
    segment_lengths = np.sqrt(np.sum(deltas ** 2, axis=1))
    cum_dist = np.insert(np.cumsum(segment_lengths), 0, 0.0)
    total_length = cum_dist[-1]

    if total_length == 0:
        raise ValueError("Static gesture detected; invalid signature stroke.")

    interp_dists = np.linspace(0.0, total_length, target_n)
    rx = np.interp(interp_dists, cum_dist, pts[:, 0])
    ry = np.interp(interp_dists, cum_dist, pts[:, 1])
    return np.column_stack((rx, ry))


def extract_shape_features(raw_points: List[Tuple[float, float]], target_n: int = 64) -> np.ndarray:
    """
    Normalizes coordinates and extracts relative turning angles (dTheta).
    Output: (64, 3) matrix -> [norm_x, norm_y, sin(dTheta) * 0.5]
    """
    pts = np.array(raw_points, dtype=np.float64)
    if len(pts) < 8:
        raise ValueError("Signature contains too few points.")

    # 1. Centroid translation to origin (0, 0)
    pts -= np.mean(pts, axis=0)

    # 2. Scale normalization preserving aspect ratio
    max_span = np.max(np.ptp(pts, axis=0))
    if max_span > 0:
        pts /= max_span

    # 3. Equidistant arc-length resampling
    uniform_pts = resample_trajectory(pts, target_n=target_n)

    # 4. Heading delta angles
    diffs = np.diff(uniform_pts, axis=0)
    headings = np.arctan2(diffs[:, 1], diffs[:, 0])
    turn_angles = np.diff(headings)
    turn_angles = (turn_angles + np.pi) % (2 * np.pi) - np.pi
    turn_angles = np.pad(turn_angles, (1, 1), mode='edge').reshape(-1, 1)

    return np.hstack((uniform_pts, np.sin(turn_angles) * 0.5))


def extract_behavioral_profile(kinematics: List[List[float]]) -> np.ndarray:
    """
    Extracts 16-dimensional behavioral motion vector:
    velocity statistics, acceleration peaks, hand tilt, and speed histogram.
    """
    if not kinematics or len(kinematics) < 6:
        return np.zeros(16, dtype=np.float64)

    arr = np.array(kinematics, dtype=np.float64)
    coords = arr[:, :2]
    times = arr[:, 2] / 1000.0
    angles = arr[:, 3]

    dt = np.diff(times)
    dt[dt <= 0] = 0.016

    dist = np.sqrt(np.sum(np.diff(coords, axis=0) ** 2, axis=1))
    speeds = dist / dt
    accel = np.diff(speeds) / dt[:-1]

    v_mean = float(np.mean(speeds))
    v_std = float(np.std(speeds))
    v_max = float(np.max(speeds))
    v_median = float(np.median(speeds))

    a_std = float(np.std(accel)) if len(accel) > 0 else 0.0
    a_max = float(np.max(np.abs(accel))) if len(accel) > 0 else 0.0

    angle_mean = float(np.mean(angles))
    angle_std = float(np.std(angles))

    hist, _ = np.histogram(speeds, bins=8, density=True)
    stats = np.array([v_mean, v_std, v_max, v_median, a_std, a_max, angle_mean, angle_std], dtype=np.float64)
    
    # Type-safe concatenation to prevent Pylance overload mismatch
    profile = np.concatenate([stats, hist.astype(np.float64)])
    norm = np.linalg.norm(profile)
    return profile / norm if norm > 0 else profile


# =====================================================================
# 2. CONSTRAINED DYNAMIC TIME WARPING & DBA SYNTHESIS
# =====================================================================

def compute_pairwise_dtw(s1: np.ndarray, s2: np.ndarray, w: int = 14) -> Tuple[float, List[Tuple[int, int]]]:
    """Computes DTW alignment path with Sakoe-Chiba constraint band w[cite: 1]."""
    n, m = len(s1), len(s2)
    w = max(w, abs(n - m))

    cost = np.linalg.norm(s1[:, None, :] - s2[None, :, :], axis=-1)
    dtw = np.full((n + 1, m + 1), np.inf)
    dtw[0, 0] = 0.0

    for i in range(1, n + 1):
        j_start = max(1, i - w)
        j_end = min(m, i + w)
        for j in range(j_start, j_end + 1):
            dtw[i, j] = cost[i - 1, j - 1] + min(
                dtw[i - 1, j],
                dtw[i, j - 1],
                dtw[i - 1, j - 1]
            )

    # Backtracking alignment path
    path: List[Tuple[int, int]] = []
    i, j = n, m
    while i > 0 and j > 0:
        path.append((i - 1, j - 1))
        scores = [dtw[i - 1, j - 1], dtw[i - 1, j], dtw[i, j - 1]]
        min_idx = int(np.argmin(scores))
        if min_idx == 0:
            i -= 1
            j -= 1
        elif min_idx == 1:
            i -= 1
        else:
            j -= 1

    while i > 0:
        path.append((i - 1, 0))
        i -= 1
    while j > 0:
        path.append((0, j - 1))
        j -= 1

    return float(dtw[n, m]), path[::-1]


def dtw_barycenter_averaging(samples: List[np.ndarray], iterations: int = 6) -> np.ndarray:
    """Synthesizes a master centroid template from K enrollment passes."""
    barycenter = np.copy(samples[0])
    n_points, _ = barycenter.shape

    for _ in range(iterations):
        associations: List[List[np.ndarray]] = [[] for _ in range(n_points)]
        for seq in samples:
            _, path = compute_pairwise_dtw(barycenter, seq)
            for b_idx, s_idx in path:
                associations[b_idx].append(seq[s_idx])

        for idx in range(n_points):
            if len(associations[idx]) > 0:
                barycenter[idx] = np.mean(associations[idx], axis=0)

    return barycenter


# =====================================================================
# 3. ENCRYPTED BIOMETRIC VAULT (AES-256-GCM)
# =====================================================================

class SecureBiometricVault:
    def __init__(self, master_key_hex: Optional[str] = None, db_path: str = DB_FILE):
        self.db_path = db_path
        if master_key_hex:
            self.master_key = bytes.fromhex(master_key_hex)
        else:
            # 256-bit key (in enterprise production, retrieve from HashiCorp Vault)
            self.master_key = b'\xa5\xb2\xc3\xd4\xe5\xf6\x07\x18\x29\x3a\x4b\x5c\x6d\x7e\x8f\x90' \
                              b'\x11\x22\x33\x44\x55\x66\x77\x88\x99\xaa\xbb\xcc\xdd\xee\xff\x00'
        self.aesgcm = AESGCM(self.master_key)
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("PRAGMA table_info(biometric_vault)")
            columns = [row[1] for row in cursor.fetchall()]

            # Clean schema migration if outdated table definition exists
            if columns and ("sample_count" in columns or "feature_dim" in columns):
                cursor.execute("DROP TABLE biometric_vault")

            cursor.execute("""
                CREATE TABLE IF NOT EXISTS biometric_vault (
                    user_id TEXT PRIMARY KEY,
                    nonce BLOB NOT NULL,
                    ciphertext BLOB NOT NULL,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.commit()

    def save_fused_template(self, user_id: str, passes: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Synthesizes a 3-pass DBA master shape and movement vector, encrypting both at rest."""
        shape_matrices = [extract_shape_features(p["points"]) for p in passes]
        master_shape = dtw_barycenter_averaging(shape_matrices)

        behavior_vectors = [extract_behavioral_profile(p.get("kinematics", [])) for p in passes]
        master_behavior = np.mean(behavior_vectors, axis=0)
        norm = np.linalg.norm(master_behavior)
        if norm > 0:
            master_behavior /= norm

        payload = {
            "master_shape": master_shape.tolist(),
            "master_behavior": master_behavior.tolist()
        }
        payload_bytes = json.dumps(payload).encode('utf-8')

        nonce = os.urandom(12)
        ciphertext = self.aesgcm.encrypt(nonce, payload_bytes, user_id.encode('utf-8'))

        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO biometric_vault (user_id, nonce, ciphertext)
                VALUES (?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    nonce = excluded.nonce,
                    ciphertext = excluded.ciphertext,
                    updated_at = CURRENT_TIMESTAMP
            """, (user_id, nonce, ciphertext))
            conn.commit()

        return {
            "status": "success",
            "user_id": user_id,
            "passes_synthesized": len(passes),
            "template_shape": list(master_shape.shape)
        }

    def load_fused_template(self, user_id: str) -> Dict[str, np.ndarray]:
        """Loads and decrypts the master shape and behavioral profiles in memory."""
        with sqlite3.connect(self.db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT nonce, ciphertext FROM biometric_vault WHERE user_id = ?", (user_id,))
            row = cursor.fetchone()

        if not row:
            raise LookupError(f"User '{user_id}' has not enrolled an air-signature template.")

        nonce, ciphertext = row
        decrypted = self.aesgcm.decrypt(nonce, ciphertext, user_id.encode('utf-8'))
        data = json.loads(decrypted.decode('utf-8'))

        return {
            "master_shape": np.array(data["master_shape"], dtype=np.float64),
            "master_behavior": np.array(data["master_behavior"], dtype=np.float64)
        }


# =====================================================================
# 4. DUAL-STREAM BIOMETRIC COMPARATOR
# =====================================================================

def match_against_fused_template(
    cand_points: List[Tuple[float, float]],
    cand_kinematics: List[List[float]],
    stored: Dict[str, np.ndarray],
    threshold: float = 17.5
) -> Tuple[bool, float, float, float, float]:
    """
    Score-level fusion[cite: 1]:
    - 70% Shape Alignment via Sakoe-Chiba DTW
    - 30% Behavioral Kinematic Distance via Cosine Metric
    """
    cand_shape = extract_shape_features(cand_points)
    shape_dist, _ = compute_pairwise_dtw(cand_shape, stored["master_shape"], w=14)

    cand_behavior = extract_behavioral_profile(cand_kinematics)
    behavior_dist = float(1.0 - np.dot(cand_behavior, stored["master_behavior"])) * 15.0

    fused_cost = 0.70 * shape_dist + 0.30 * behavior_dist
    is_authenticated = bool(fused_cost <= threshold)
    confidence = max(0.0, min(100.0, (1.0 - (fused_cost / (threshold * 1.8))) * 100.0))

    return is_authenticated, round(fused_cost, 2), round(shape_dist, 2), round(behavior_dist, 2), round(confidence, 1)