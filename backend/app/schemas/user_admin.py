from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.enums import UserRole
from app.schemas.document import SectorOption


class UserAdminBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=255)
    role: UserRole
    sector_id: int | None = None

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if "@" not in normalized or normalized.startswith("@") or normalized.endswith("@"):
            raise ValueError("Invalid email format.")
        return normalized


class UserAdminCreate(UserAdminBase):
    password: str = Field(min_length=6, max_length=255)


class UserAdminUpdate(UserAdminBase):
    password: str | None = Field(default=None, min_length=6, max_length=255)


class UserAdminRead(UserAdminBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class UserAdminOptionsRead(BaseModel):
    roles: list[UserRole]
    sectors: list[SectorOption]
