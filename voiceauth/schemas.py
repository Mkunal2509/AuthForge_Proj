from pydantic import BaseModel, EmailStr


class UserResponse(BaseModel):

    id: int
    username: str
    email: EmailStr
    language: str
    is_active: bool

    class Config:
        from_attributes = True


class HealthResponse(BaseModel):

    status: str
    message: str