import re

from pydantic import BaseModel, Field, field_validator

_PASSWORD_HAS_DIGIT_PATTERN = re.compile(r"\d")
_PASSWORD_HAS_SPECIAL_PATTERN = re.compile(r"[^A-Za-z0-9\s]")


def _validate_password_complexity(value: str) -> str:
    if _PASSWORD_HAS_DIGIT_PATTERN.search(value) is None:
        raise ValueError("Password must include at least one number.")
    if _PASSWORD_HAS_SPECIAL_PATTERN.search(value) is None:
        raise ValueError("Password must include at least one special character.")
    return value


class LoginRequest(BaseModel):
    username: str = Field(min_length=3, max_length=120)
    password: str = Field(min_length=1)

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not normalized:
            raise ValueError("Username is required.")
        return normalized


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    must_change_password: bool = False


class ChangePasswordRequest(BaseModel):
    old_password: str = Field(min_length=1)
    new_password: str = Field(min_length=8, max_length=255)
    new_password_confirm: str = Field(min_length=8, max_length=255)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        return _validate_password_complexity(value)

    @field_validator("new_password_confirm")
    @classmethod
    def validate_new_password_confirm(cls, value: str) -> str:
        return _validate_password_complexity(value)
