import sys
from pathlib import Path

CURRENT_DIR = Path(__file__).resolve().parent
ROOT_DIR = CURRENT_DIR.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

try:
    from core_auth.password_engine import hash_password
except ModuleNotFoundError:
    from password_engine import hash_password

from database import init_db, get_connection

def seed_environment():
    init_db()
    conn = get_connection()
    cur = conn.cursor()

    dev_pass = hash_password("developer_secret")
    cur.execute("""
        INSERT INTO users (user_id, role, password_hash, phone_number)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            password_hash = excluded.password_hash,
            role = excluded.role
    """, ("developer_admin", "developer", dev_pass, "+10000000001"))

    user_pass = hash_password("user_secret")
    cur.execute("""
        INSERT INTO users (user_id, role, password_hash, phone_number)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            password_hash = excluded.password_hash,
            role = excluded.role
    """, ("test_user", "user", user_pass, "+10000000002"))

    cur.execute("""
        INSERT INTO tenants (client_id, api_key, app_name, policy)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(client_id) DO NOTHING
    """, (
        "client_apex_demo",
        "sk_test_1234567890abcdef",
        "Apex Banking Demo",
        '{"primary": "password", "secondary": "otp"}'
    ))

    conn.commit()
    conn.close()
    print("Database seeded successfully.")

if __name__ == "__main__":
    seed_environment()