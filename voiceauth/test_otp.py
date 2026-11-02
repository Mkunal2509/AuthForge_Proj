from app.services.otp_service import (
    generate_otp,
    hash_otp,
    verify_otp,
    get_otp_expiry
)


otp = generate_otp()

print("OTP:", otp)

hashed = hash_otp(otp)

print("Hash:", hashed)

print(
    "Correct OTP:",
    verify_otp(otp, hashed)
)

print(
    "Wrong OTP:",
    verify_otp("000000", hashed)
)

print(
    "Expires at:",
    get_otp_expiry()
)