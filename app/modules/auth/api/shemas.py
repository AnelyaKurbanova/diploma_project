from __future__ import annotations
from pydantic import BaseModel, EmailStr, Field
import uuid


class MessageOut(BaseModel):
    message: str


class RegisterStartIn(BaseModel):
    email: EmailStr


class LoginEmailStartIn(BaseModel):
    email: EmailStr


class VerifyCodeIn(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)


class AccessTokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class SessionOut(BaseModel):
    id: uuid.UUID
    ip: str | None
    user_agent: str | None
    created_at: object
    expires_at: object
    revoked_at: object | None
