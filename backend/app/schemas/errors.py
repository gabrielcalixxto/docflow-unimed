from typing import Any

from pydantic import BaseModel, Field


class ProblemDetails(BaseModel):
    type: str = Field(description="Tipo estável do erro para integração.")
    title: str = Field(description="Título resumido do erro.")
    status: int = Field(description="HTTP status code.")
    detail: str = Field(description="Descrição legível para humanos.")
    request_id: str | None = Field(
        default=None,
        description="Identificador de correlação da requisição.",
    )


class ValidationProblemDetails(ProblemDetails):
    errors: dict[str, list[str]] = Field(
        default_factory=dict,
        description="Lista de erros de validação por campo.",
    )


_ERROR_TEMPLATES: dict[int, dict[str, str]] = {
    400: {
        "type": "bad_request",
        "title": "Bad Request",
        "detail": "A requisição não pôde ser processada com os dados enviados.",
    },
    401: {
        "type": "unauthorized",
        "title": "Unauthorized",
        "detail": "Credenciais inválidas ou ausentes.",
    },
    403: {
        "type": "forbidden",
        "title": "Forbidden",
        "detail": "Usuário autenticado sem permissão para esta operação.",
    },
    404: {
        "type": "not_found",
        "title": "Not Found",
        "detail": "Recurso não encontrado.",
    },
    409: {
        "type": "conflict",
        "title": "Conflict",
        "detail": "A operação entra em conflito com o estado atual do recurso.",
    },
    413: {
        "type": "payload_too_large",
        "title": "Payload Too Large",
        "detail": "Arquivo excede o limite permitido.",
    },
    422: {
        "type": "validation_error",
        "title": "Unprocessable Entity",
        "detail": "Falha de validação dos dados enviados.",
    },
    500: {
        "type": "internal_error",
        "title": "Internal Server Error",
        "detail": "Erro interno inesperado.",
    },
}


def build_standard_error_responses(*status_codes: int) -> dict[int, dict[str, Any]]:
    responses: dict[int, dict[str, Any]] = {}
    for status_code in status_codes:
        template = _ERROR_TEMPLATES.get(
            status_code,
            {
                "type": "error",
                "title": "Error",
                "detail": "Falha na requisição.",
            },
        )
        example: dict[str, Any] = {
            "type": template["type"],
            "title": template["title"],
            "status": status_code,
            "detail": template["detail"],
            "request_id": "a1b2c3d4",
        }
        model = ProblemDetails
        if status_code == 422:
            example["errors"] = {"field": ["Campo obrigatório."]}
            model = ValidationProblemDetails

        responses[status_code] = {
            "model": model,
            "description": template["title"],
            "content": {"application/json": {"example": example}},
        }
    return responses
