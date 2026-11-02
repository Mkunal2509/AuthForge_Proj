import sys
import sqlite3
import os
from pathlib import Path

CURRENT_DIR = Path(__file__).resolve().parent
ROOT_DIR = CURRENT_DIR.parent.parent
DB_PATH = CURRENT_DIR / "authforge_secure.db"

# Register paths for module discovery
for p in [ROOT_DIR, CURRENT_DIR, ROOT_DIR / "core_auth"]:
    str_p = str(p)
    if str_p not in sys.path and p.exists():
        sys.path.insert(0, str_p)

def get_connection():
    """Returns an active SQLite database connection with row-factory enabled."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def _get_argon2_hasher():
    """Retrieves standard Argon2id hasher across project imports or native argon2."""
    try:
        from core_auth.password_engine import hash_password
        return hash_password
    except ImportError:
        try:
            from password_engine import hash_password
            return hash_password
        except ImportError:
            from argon2 import PasswordHasher
            ph = PasswordHasher(time_cost=2, memory_cost=65536, parallelism=1)
            return ph.hash

def init_db():
    """Initializes schema tables and seeds initial users and demo tenants."""
    conn = get_connection()
    cur = conn.cursor()

    # 1. Tenants (Developer App Policies)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS tenants (
            client_id TEXT PRIMARY KEY,
            api_key TEXT NOT NULL,
            app_name TEXT NOT NULL,
            policy TEXT NOT NULL DEFAULT '{"primary": "airsig", "stepup": "otp", "threshold_accept": 0.18, "threshold_challenge": 0.26}',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # 2. Users Table
    cur.execute("""
        CREATE TABLE IF NOT EXISTS users (
            user_id TEXT PRIMARY KEY,
            password_hash TEXT NOT NULL,
            role TEXT DEFAULT 'user',
            phone_number TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    """)

    # 3. OTP Cache (Target-normalized for SMS & Email)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS otp_cache (
            target TEXT PRIMARY KEY,
            otp_code TEXT NOT NULL,
            expires_at INTEGER NOT NULL
        );
    """)

    hasher = _get_argon2_hasher()

    # Seed User 1: Kunal
    kunal_hash = hasher("kunal_2509")
    cur.execute("""
        INSERT INTO users (user_id, password_hash, role, phone_number)
        VALUES (?, ?, 'user', '+919876543210')
        ON CONFLICT(user_id) DO UPDATE SET
            password_hash = excluded.password_hash
    """, ("kunal", kunal_hash))

    # Seed User 2: Sanika
    sanika_hash = hasher("sanika_2409")
    cur.execute("""
        INSERT INTO users (user_id, password_hash, role, phone_number)
        VALUES (?, ?, 'user', '+919876543211')
        ON CONFLICT(user_id) DO UPDATE SET
            password_hash = excluded.password_hash
    """, ("sanika", sanika_hash))

    # Seed Default Developer Admin
    admin_hash = hasher("developer_secret")
    cur.execute("""
        INSERT INTO users (user_id, password_hash, role, phone_number)
        VALUES (?, ?, 'developer', '+10000000001')
        ON CONFLICT(user_id) DO UPDATE SET
            password_hash = excluded.password_hash,
            role = excluded.role
    """, ("developer_admin", admin_hash))

    # Seed Default Banking Tenant
    cur.execute("""
        INSERT INTO tenants (client_id, api_key, app_name, policy)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(client_id) DO UPDATE SET
            app_name = excluded.app_name,
            policy = excluded.policy
    """, (
        "client_apex_demo",
        "sk_live_apex_secure_token",
        "Apex Online Banking",
        '{"primary": "airsig", "stepup": "otp", "threshold_accept": 0.18, "threshold_challenge": 0.26}'
    ))

    conn.commit()
    conn.close()
    print("[DB] Initialized database and verified user credentials for 'kunal', 'sanika', and 'developer_admin'.")

if __name__ == "__main__":
    init_db()