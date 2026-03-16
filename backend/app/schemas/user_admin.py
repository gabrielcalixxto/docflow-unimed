import re

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.enums import UserRole
from app.schemas.document import CompanyOption, SectorOption

_USERNAME_PATTERN = re.compile(r"^[a-z]+(?:\.[a-z]+)+$")
_PASSWORD_HAS_DIGIT_PATTERN = re.compile(r"\d")
_PASSWORD_HAS_SPECIAL_PATTERN = re.compile(r"[^A-Za-z0-9\s]")


def _validate_password_complexity(value: str) -> str:
    if _PASSWORD_HAS_DIGIT_PATTERN.search(value) is None:
        raise ValueError("Password must include at least one number.")
    if _PASSWORD_HAS_SPECIAL_PATTERN.search(value) is None:
        raise ValueError("Password must include at least one special character.")
    return value


class UserAdminBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    username: str = Field(min_length=3, max_length=120)
    email: str = Field(min_length=3, max_length=255)
    roles: list[UserRole] = Field(default_factory=list)
    company_ids: list[int] = Field(default_factory=list)
    sector_ids: list[int] = Field(default_factory=list)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        normalized = " ".join((value or "").strip().split())
        if not normalized:
            raise ValueError("Name is required.")
        return normalized

    @field_validator("username")
    @classmethod
    def validate_username(cls, value: str) -> str:
        normalized = (value or "").strip().lower()
        if not _USERNAME_PATTERN.fullmatch(normalized):
            raise ValueError("Username must follow nome.texto format using letters and dots only.")
        return normalized

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if "@" not in normalized or normalized.startswith("@") or normalized.endswith("@"):
            raise ValueError("Invalid email format.")
        return normalized

    @field_validator("roles")
    @classmethod
    def validate_roles(cls, value: list[UserRole]) -> list[UserRole]:
        deduplicated: list[UserRole] = []
        for role in value:
            if role not in deduplicated:
                deduplicated.append(role)
        if not deduplicated:
            raise ValueError("At least one role is required.")
        return deduplicated

    @field_validator("company_ids")
    @classmethod
    def validate_company_ids(cls, value: list[int]) -> list[int]:
        deduplicated: list[int] = []
        for company_id in value:
            if company_id <= 0:
                raise ValueError("Company id must be a positive integer.")
            if company_id not in deduplicated:
                deduplicated.append(company_id)
        return deduplicated

    @field_validator("sector_ids")
    @classmethod
    def validate_sector_ids(cls, value: list[int]) -> list[int]:
        deduplicated: list[int] = []
        for sector_id in value:
            if sector_id <= 0:
                raise ValueError("Sector id must be a positive integer.")
            if sector_id not in deduplicated:
                deduplicated.append(sector_id)
        return deduplicated


class UserAdminCreate(UserAdminBase):
    password: str = Field(min_length=8, max_length=255)

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return _validate_password_complexity(value)


class UserAdminUpdate(UserAdminBase):
    password: str | None = Field(default=None, min_length=8, max_length=255)

    @field_validator("password")
    @classmethod
    def validate_optional_password(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _validate_password_complexity(value)


class UserAdminRead(UserAdminBase):
    id: int
    role: UserRole
    company_id: int | None = None
    sector_id: int | None = None

    model_config = ConfigDict(from_attributes=True)


class UserAdminOptionsRead(BaseModel):
    roles: list[UserRole]
    companies: list[CompanyOption]
    sectors: list[SectorOption]
