"""Email/password authentication with server-side persistent sessions."""
from __future__ import annotations

import hashlib
import hmac
import re
import secrets
import uuid
from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.config import settings
from app.models.user import User, UserSession
from app.models.workspace import Workspace

router = APIRouter()

SESSION_COOKIE_NAME = "ecopath_session"
SESSION_LIFETIME = timedelta(days=30)
PASSWORD_ITERATIONS = 310_000


class Credentials(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", normalized):
            raise ValueError("Enter a valid email address.")
        return normalized


def _hash_password(
    password: str,
    salt: bytes | None = None,
    iterations: int = PASSWORD_ITERATIONS,
) -> str:
    password_salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        password_salt,
        iterations,
    )
    return f"pbkdf2_sha256${iterations}${password_salt.hex()}${digest.hex()}"


def _verify_password(password: str, encoded_hash: str) -> bool:
    try:
        algorithm, iteration_count, salt_hex, expected_hex = encoded_hash.split("$", 3)
        iterations = int(iteration_count)
        if algorithm != "pbkdf2_sha256" or not 100_000 <= iterations <= 2_000_000:
            return False
        actual = _hash_password(
            password,
            bytes.fromhex(salt_hex),
            iterations,
        ).split("$", 3)[3]
        return hmac.compare_digest(actual, expected_hex)
    except (ValueError, TypeError):
        return False


def _new_session(db: Session, user: User, response: Response) -> None:
    token = secrets.token_urlsafe(48)
    expires_at = datetime.utcnow() + SESSION_LIFETIME
    db.add(
        UserSession(
            id=f"sess-{uuid.uuid4().hex}",
            user_id=user.id,
            token_hash=hashlib.sha256(token.encode("utf-8")).hexdigest(),
            expires_at=expires_at,
        )
    )
    db.commit()
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=int(SESSION_LIFETIME.total_seconds()),
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        path="/",
    )


_DUMMY_PASSWORD_HASH = _hash_password("not-a-user-password", bytes(16))


def _user_payload(user: User) -> dict[str, str]:
    return {"id": user.id, "email": user.email}


def get_current_user(
    db: Session = Depends(get_db),
    session_token: Annotated[str | None, Cookie(alias=SESSION_COOKIE_NAME)] = None,
) -> User:
    if not session_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Sign in to continue.")

    token_hash = hashlib.sha256(session_token.encode("utf-8")).hexdigest()
    session = (
        db.query(UserSession)
        .filter(
            UserSession.token_hash == token_hash,
            UserSession.expires_at > datetime.utcnow(),
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Your session has expired. Sign in again.")

    db.info["authenticated_user_id"] = session.user_id
    user = db.get(User, session.user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account not found.")
    return user


def require_authenticated_user(user: User = Depends(get_current_user)) -> User:
    return user


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(
    payload: Credentials,
    response: Response,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    user = User(
        id=f"user-{uuid.uuid4().hex}",
        email=payload.email,
        password_hash=_hash_password(payload.password),
    )
    db.add(user)
    try:
        db.flush()
        if db.query(User.id).count() == 1:
            db.query(Workspace).filter(Workspace.owner_id.is_(None)).update(
                {Workspace.owner_id: user.id},
                synchronize_session=False,
            )
        _new_session(db, user, response)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail="An account with this email already exists.") from exc
    return _user_payload(user)


@router.post("/login")
def login(
    payload: Credentials,
    response: Response,
    db: Session = Depends(get_db),
) -> dict[str, str]:
    user = db.query(User).filter(User.email == payload.email).first()
    password_is_valid = _verify_password(
        payload.password,
        user.password_hash if user else _DUMMY_PASSWORD_HASH,
    )
    if not user or not password_is_valid:
        raise HTTPException(status_code=401, detail="Email or password is incorrect.")
    _new_session(db, user, response)
    return _user_payload(user)


@router.get("/me")
def get_session_user(user: User = Depends(get_current_user)) -> dict[str, str]:
    return _user_payload(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    response: Response,
    db: Session = Depends(get_db),
    session_token: Annotated[str | None, Cookie(alias=SESSION_COOKIE_NAME)] = None,
) -> Response:
    if session_token:
        token_hash = hashlib.sha256(session_token.encode("utf-8")).hexdigest()
        db.query(UserSession).filter(UserSession.token_hash == token_hash).delete()
        db.commit()
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
        path="/",
    )
    response.status_code = status.HTTP_204_NO_CONTENT
    return response
