from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.enums import DocumentScope

MAX_CREATE_EXPIRATION_YEARS = 2


def _add_years(base_date: date, years: int) -> date:
    try:
        return base_date.replace(year=base_date.year + years)
    except ValueError:
        # Handle leap day by clamping to Feb 28 on non-leap years.
        return base_date.replace(year=base_date.year + years, month=2, day=28)


class DocumentCreate(BaseModel):
    title: str
    company_id: int
    sector_id: int
    document_type: str
    scope: DocumentScope
    file_path: str
    expiration_date: date

    @field_validator("expiration_date")
    @classmethod
    def validate_expiration_date(cls, value: date) -> date:
        today = date.today()
        max_expiration_date = _add_years(today, MAX_CREATE_EXPIRATION_YEARS)
        if value < today:
            raise ValueError("Expiration date cannot be earlier than today.")
        if value > max_expiration_date:
            raise ValueError(
                f"Expiration date cannot be later than {MAX_CREATE_EXPIRATION_YEARS} years from today.",
            )
        return value


class CompanyOption(BaseModel):
    id: int
    name: str

    model_config = ConfigDict(from_attributes=True)


class SectorOption(BaseModel):
    id: int
    name: str
    sigla: str | None = None
    company_id: int

    model_config = ConfigDict(from_attributes=True)


class DocumentTypeOption(BaseModel):
    sigla: str
    name: str


class DocumentFormOptionsRead(BaseModel):
    companies: list[CompanyOption]
    sectors: list[SectorOption]
    document_types: list[str]
    document_type_options: list[DocumentTypeOption] = Field(default_factory=list)
    scopes: list[DocumentScope]


class DocumentRejectRequest(BaseModel):
    reason: str | None = Field(default=None, max_length=500)


class DocumentDraftUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    file_path: str | None = Field(default=None, min_length=1, max_length=255)
    expiration_date: date | None = None

    @field_validator("expiration_date")
    @classmethod
    def validate_expiration_date(cls, value: date | None) -> date | None:
        if value is not None and value < date.today():
            raise ValueError("Expiration date cannot be earlier than today.")
        return value


class DocumentRead(BaseModel):
    id: int
    code: str
    title: str
    company_id: int
    sector_id: int
    document_type: str
    scope: DocumentScope
    created_by: int | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
