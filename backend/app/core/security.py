from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from app.core.config import settings
from app.core.enums import UserRole

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


@dataclass(slots=True)
class AuthenticatedUser:
    email: str
    role: UserRole
    username: str | None = None
    roles: list[UserRole] | None = None
    user_id: int | None = None
    company_id: int | None = None
    company_ids: list[int] | None = None
    sector_id: int | None = None
    sector_ids: list[int] | None = None

    def has_role(self, role: UserRole) -> bool:
        normalized_roles = self.normalized_roles()
        return role in normalized_roles

    def has_any_role(self, roles: set[UserRole]) -> bool:
        normalized_roles = set(self.normalized_roles())
        return not normalized_roles.isdisjoint(roles)

    def normalized_roles(self) -> list[UserRole]:
        values = []
        if self.roles:
            values.extend(self.roles)
        values.append(self.role)
        deduplicated: list[UserRole] = []
        for value in values:
            if value not in deduplicated:
                deduplicated.append(value)
        return deduplicated

    def normalized_sector_ids(self) -> list[int]:
        values = []
        if self.sector_ids:
            values.extend(self.sector_ids)
        if self.sector_id is not None:
            values.append(self.sector_id)

        deduplicated: list[int] = []
        for value in values:
            if isinstance(value, int) and value not in deduplicated:
                deduplicated.append(value)
        return deduplicated

    def normalized_company_ids(self) -> list[int]:
        values = []
        if self.company_ids:
            values.extend(self.company_ids)
        if self.company_id is not None:
            values.append(self.company_id)

        deduplicated: list[int] = []
        for value in values:
            if isinstance(value, int) and value not in deduplicated:
                deduplicated.append(value)
        return deduplicated


def hash_password(password: str) -> str:
    password_bytes = password.encode("utf-8")
    hashed = bcrypt.hashpw(password_bytes, bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(
            plain_password.encode("utf-8"),
            hashed_password.encode("utf-8"),
        )
    except ValueError:
        return False


def create_access_token(
    *,
    subject: str,
    role: UserRole,
    roles: list[UserRole] | None = None,
    email: str | None = None,
    user_id: int | None = None,
    company_id: int | None = None,
    company_ids: list[int] | None = None,
    sector_id: int | None = None,
    sector_ids: list[int] | None = None,
) -> str:
    expire_at = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
    normalized_roles = []
    for value in [*(roles or []), role]:
        if value.value not in normalized_roles:
            normalized_roles.append(value.value)

    normalized_company_ids = []
    for value in [*(company_ids or []), *([company_id] if company_id is not None else [])]:
        if isinstance(value, int) and value not in normalized_company_ids:
            normalized_company_ids.append(value)

    normalized_sector_ids = []
    for value in [*(sector_ids or []), *([sector_id] if sector_id is not None else [])]:
        if isinstance(value, int) and value not in normalized_sector_ids:
            normalized_sector_ids.append(value)

    payload: dict[str, object] = {
        "sub": subject,
        "role": role.value,
        "roles": normalized_roles,
        "email": email,
        "user_id": user_id,
        "company_id": company_id,
        "company_ids": normalized_company_ids,
        "sector_id": sector_id,
        "sector_ids": normalized_sector_ids,
        "exp": expire_at,
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def get_current_user(token: str = Depends(oauth2_scheme)) -> AuthenticatedUser:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        subject = payload.get("sub")
        role_value = payload.get("role")
        if not isinstance(subject, str) or not isinstance(role_value, str):
            raise credentials_error
        role = UserRole(role_value)
        roles_value = payload.get("roles")
        roles: list[UserRole] = []
        if isinstance(roles_value, list):
            for item in roles_value:
                if isinstance(item, str):
                    try:
                        parsed = UserRole(item)
                    except ValueError:
                        continue
                    if parsed not in roles:
                        roles.append(parsed)
        if role not in roles:
            roles.append(role)

        email = payload.get("email")
        if not isinstance(email, str):
            email = subject

        user_id = payload.get("user_id")
        if user_id is not None and not isinstance(user_id, int):
            user_id = None
        company_id = payload.get("company_id")
        if company_id is not None and not isinstance(company_id, int):
            company_id = None
        company_ids_value = payload.get("company_ids")
        company_ids: list[int] = []
        if isinstance(company_ids_value, list):
            for item in company_ids_value:
                if isinstance(item, int) and item not in company_ids:
                    company_ids.append(item)
        if company_id is not None and company_id not in company_ids:
            company_ids.append(company_id)

        sector_id = payload.get("sector_id")
        if sector_id is not None and not isinstance(sector_id, int):
            sector_id = None
        sector_ids_value = payload.get("sector_ids")
        sector_ids: list[int] = []
        if isinstance(sector_ids_value, list):
            for item in sector_ids_value:
                if isinstance(item, int) and item not in sector_ids:
                    sector_ids.append(item)
        if sector_id is not None and sector_id not in sector_ids:
            sector_ids.append(sector_id)
    except (JWTError, ValueError) as exc:
        raise credentials_error from exc

    return AuthenticatedUser(
        email=email,
        username=subject,
        role=role,
        roles=roles,
        user_id=user_id,
        company_id=company_id,
        company_ids=company_ids,
        sector_id=sector_id,
        sector_ids=sector_ids,
    )
