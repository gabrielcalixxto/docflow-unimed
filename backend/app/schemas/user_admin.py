from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.enums import UserRole
from app.schemas.document import CompanyOption, SectorOption


class UserAdminBase(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=255)
    roles: list[UserRole] = Field(default_factory=list)
    company_ids: list[int] = Field(default_factory=list)
    sector_ids: list[int] = Field(default_factory=list)

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
    password: str = Field(min_length=6, max_length=255)


class UserAdminUpdate(UserAdminBase):
    password: str | None = Field(default=None, min_length=6, max_length=255)


class UserAdminRead(UserAdminBase):
    id: int
    username: str
    role: UserRole
    company_id: int | None = None
    sector_id: int | None = None

    model_config = ConfigDict(from_attributes=True)


class UserAdminOptionsRead(BaseModel):
    roles: list[UserRole]
    companies: list[CompanyOption]
    sectors: list[SectorOption]
