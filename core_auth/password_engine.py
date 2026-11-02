from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHashError

ph = PasswordHasher(time_cost=2, memory_cost=65536, parallelism=1)

def hash_password(password: str) -> str:
    return ph.hash(password)

def verify_password(stored_hash: str, candidate_password: str) -> bool:
    if not stored_hash:
        return False
    try:
        return ph.verify(stored_hash, candidate_password)
    except (VerifyMismatchError, InvalidHashError):
        return False