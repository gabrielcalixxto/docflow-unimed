from pydantic import BaseModel, ConfigDict, Field


class AdminCompanyCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)


class AdminCompanyUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=120)


class AdminCompanyRead(BaseModel):
    id: int
    name: str

    model_config = ConfigDict(from_attributes=True)


class AdminSectorCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    sigla: str = Field(min_length=1, max_length=40)
    company_id: int


class AdminSectorUpdate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    sigla: str = Field(min_length=1, max_length=40)
    company_id: int


class AdminSectorRead(BaseModel):
    id: int
    name: str
    sigla: str | None = None
    company_id: int

    model_config = ConfigDict(from_attributes=True)


class AdminDocumentTypeCreate(BaseModel):
    sigla: str = Field(min_length=1, max_length=40)
    name: str = Field(min_length=2, max_length=120)


class AdminDocumentTypeUpdate(BaseModel):
    sigla: str = Field(min_length=1, max_length=40)
    name: str = Field(min_length=2, max_length=120)


class AdminDocumentTypeRead(BaseModel):
    id: int
    sigla: str
    name: str

    model_config = ConfigDict(from_attributes=True)


class AdminCatalogOptionsRead(BaseModel):
    companies: list[AdminCompanyRead]
    sectors: list[AdminSectorRead]
    document_types: list[AdminDocumentTypeRead]
