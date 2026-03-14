from enum import Enum


class UserRole(str, Enum):
    AUTOR = "AUTOR"
    REVISOR = "REVISOR"
    COORDENADOR = "COORDENADOR"
    LEITOR = "LEITOR"
    ADMIN = "ADMIN"


class DocumentScope(str, Enum):
    CORPORATIVO = "CORPORATIVO"
    LOCAL = "LOCAL"


class DocumentStatus(str, Enum):
    RASCUNHO = "RASCUNHO"
    REVISAR_RASCUNHO = "REVISAR_RASCUNHO"
    PENDENTE_COORDENACAO = "PENDENTE_COORDENACAO"
    EM_REVISAO = "EM_REVISAO"
    REPROVADO = "REPROVADO"
    VIGENTE = "VIGENTE"
    OBSOLETO = "OBSOLETO"


class DocumentEventType(str, Enum):
    DOCUMENT_CREATED = "document_created"
    VERSION_CREATED = "version_created"
    SUBMITTED_FOR_REVIEW = "submitted_for_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    SET_TO_VIGENTE = "set_to_vigente"
    MARKED_OBSOLETE = "marked_obsolete"
    DOCUMENT_VIEWED = "document_viewed"
