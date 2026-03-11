from jose import jwt

from app.core.config import settings


def test_healthcheck_returns_ok(public_client) -> None:
    response = public_client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_auth_login_returns_jwt_bearer_token(public_client) -> None:
    response = public_client.post(
        "/auth/login",
        json={"email": "coord.nutricao@example.com", "password": "secret"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    decoded = jwt.decode(
        body["access_token"],
        settings.jwt_secret_key,
        algorithms=[settings.jwt_algorithm],
    )
    assert decoded["sub"] == "coord.nutricao@example.com"
    assert decoded["role"] == "COORDENADOR"


def test_protected_documents_route_requires_authentication(public_client) -> None:
    response = public_client.get("/documents")

    assert response.status_code == 401
