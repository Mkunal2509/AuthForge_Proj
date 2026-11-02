import time
import secrets
import sqlite3
import os
import re
from pathlib import Path

CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent
DB_PATH = PROJECT_ROOT / "airsig" / "backend" / "authforge_secure.db"

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "")

def normalize_target(target: str) -> str:
    t = str(target).strip()
    if "@" in t:
        return t.lower()
    cleaned = re.sub(r"[\s\-\(\)]", "", t)
    if not cleaned.startswith("+"):
        if len(cleaned) == 10:
            cleaned = "+91" + cleaned
        else:
            cleaned = "+" + cleaned
    return cleaned

def _get_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def _init_db():
    conn = _get_db()
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='otp_cache'")
    if not cur.fetchone():
        cur.execute("""
            CREATE TABLE otp_cache (
                target TEXT PRIMARY KEY,
                otp_code TEXT NOT NULL,
                expires_at INTEGER NOT NULL
            )
        """)
    else:
        cur.execute("PRAGMA table_info(otp_cache)")
        cols = [r["name"] for r in cur.fetchall()]
        if "target" not in cols:
            cur.execute("DROP TABLE otp_cache")
            cur.execute("""
                CREATE TABLE otp_cache (
                    target TEXT PRIMARY KEY,
                    otp_code TEXT NOT NULL,
                    expires_at INTEGER NOT NULL
                )
            """)
    conn.commit()
    conn.close()

_init_db()

def _send_twilio(to_phone: str, code: str) -> bool:
    if not (TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER):
        return False
    if "ACxxxx" in TWILIO_ACCOUNT_SID or "your_actual" in TWILIO_AUTH_TOKEN:
        return False
    try:
        from twilio.rest import Client
        client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        msg = client.messages.create(
            body=f"[AuthForge] Your verification code is: {code}. Valid for 3 minutes.",
            from_=TWILIO_PHONE_NUMBER,
            to=to_phone
        )
        print(f"\n[LIVE SMS SENT] Destination: {to_phone} | Message SID: {msg.sid}\n")
        return True
    except Exception as e:
        print(f"\n[TWILIO GATEWAY ERROR] {e}\n")
        return False

def issue_otp(target: str, channel: str = "sms") -> dict:
    target_clean = normalize_target(target)
    code = f"{secrets.randbelow(900000) + 100000}"
    expires_at = int(time.time()) + 180

    conn = _get_db()
    cur = conn.cursor()
    cur.execute("""
        INSERT INTO otp_cache (target, otp_code, expires_at)
        VALUES (?, ?, ?)
        ON CONFLICT(target) DO UPDATE SET
            otp_code = excluded.otp_code,
            expires_at = excluded.expires_at
    """, (target_clean, code, expires_at))
    conn.commit()
    conn.close()

    sent = False
    if channel != "email" and "@" not in target_clean:
        sent = _send_twilio(target_clean, code)

    # SECURE TERMINAL-ONLY DISPATCH LOG (Invisible to frontend DOM)
    if not sent:
        print("\n" + "=" * 60)
        print(" [AUTHFORGE SECURE TERMINAL OTP DISPATCH]")
        print(f" Target  : {target_clean}")
        print(f" OTP Code: >>> {code} <<<")
        print(" Notice  : Check this terminal for testing. Not shown on UI.")
        print("=" * 60 + "\n")

    return {
        "status": "dispatched",
        "target": target_clean,
        "delivered_via_gateway": sent
    }

def verify_otp(target: str, candidate_code: str) -> bool:
    target_clean = normalize_target(target)
    code_clean = str(candidate_code).strip()

    conn = _get_db()
    cur = conn.cursor()
    cur.execute("SELECT otp_code, expires_at FROM otp_cache WHERE target = ?", (target_clean,))
    row = cur.fetchone()

    if not row:
        print(f"[OTP VERIFY] No active code in database for {target_clean}")
        conn.close()
        return False

    stored_code = str(row["otp_code"]).strip()
    expires_at = int(row["expires_at"])

    if time.time() > expires_at:
        print(f"[OTP VERIFY] Expired code for {target_clean}")
        conn.close()
        return False

    if stored_code != code_clean:
        print(f"[OTP VERIFY] Mismatch for {target_clean}. Stored: {stored_code}, Received: {code_clean}")
        conn.close()
        return False

    cur.execute("DELETE FROM otp_cache WHERE target = ?", (target_clean,))
    conn.commit()
    conn.close()
    return True

# Compatibility wrappers
issue_phone_otp = lambda phone: issue_otp(phone, "sms")
verify_phone_otp = verify_otp