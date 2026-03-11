from enum import Enum


class UserRole(str, Enum):
    AUTOR = "AUTOR"
    COORDENADOR = "COORDENADOR"
    LEITOR = "LEITOR"
    ADMIN = "ADMIN"


class DocumentScope(str, Enum):
    CORPORATIVO = "CORPORATIVO"
    LOCAL = "LOCAL"


class DocumentStatus(str, Enum):
    RASCUNHO = "RASCUNHO"
    EM_REVISAO = "EM_REVISAO"
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
