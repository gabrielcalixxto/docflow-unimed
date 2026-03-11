from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings
from app.core.enums import UserRole

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


@dataclass(slots=True)
class AuthenticatedUser:
    email: str
    role: UserRole
    user_id: int | None = None


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(
    *,
    subject: str,
    role: UserRole,
    user_id: int | None = None,
) -> str:
    expire_at = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
    payload: dict[str, str | int | None] = {
        "sub": subject,
        "role": role.value,
        "user_id": user_id,
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
        user_id = payload.get("user_id")
        if user_id is not None and not isinstance(user_id, int):
            user_id = None
    except (JWTError, ValueError) as exc:
        raise credentials_error from exc

    return AuthenticatedUser(email=subject, role=role, user_id=user_id)
