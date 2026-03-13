from pydantic import BaseModel, ConfigDict, Field


class AdminCompanyCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)


class AdminCompanyRead(BaseModel):
    id: int
    name: str

    model_config = ConfigDict(from_attributes=True)


class AdminSectorCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    company_id: int


class AdminSectorRead(BaseModel):
    id: int
    name: str
    company_id: int

    model_config = ConfigDict(from_attributes=True)


class AdminDocumentTypeCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)


class AdminDocumentTypeRead(BaseModel):
    id: int
    name: str

    model_config = ConfigDict(from_attributes=True)


class AdminCatalogOptionsRead(BaseModel):
    companies: list[AdminCompanyRead]
    sectors: list[AdminSectorRead]
    document_types: list[AdminDocumentTypeRead]
