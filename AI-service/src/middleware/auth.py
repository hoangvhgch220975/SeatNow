"""
middleware/auth.py
JWT verification middleware.
Extracts userId and role from Bearer token → injects into request.state.
"""
import os
from fastapi import Request, HTTPException, status
import jwt
from jwt.exceptions import InvalidTokenError
from dotenv import load_dotenv

load_dotenv()

JWT_SECRET = os.getenv("JWT_ACCESS_SECRET", "vhTony_24_access")
JWT_ALGORITHM = "HS256"
INTERNAL_TOKEN = os.getenv("INTERNAL_SERVICE_TOKEN", "")


def verify_token(request: Request) -> dict:
    """
    Reads Authorization header, verifies JWT or internal service token.
    Returns payload dict with at least: sub (userId), role.
    Raises 401 on failure.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header"
        )

    token = auth_header[7:]

    # Allow internal service calls
    if INTERNAL_TOKEN and token == INTERNAL_TOKEN:
        return {"sub": "internal", "role": "admin"}

    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {e}"
        )


def get_current_user(request: Request) -> dict:
    """Dependency: returns JWT payload for any authenticated user."""
    return verify_token(request)


def get_current_customer(request: Request) -> dict:
    """Dependency: only allows role == 'customer'."""
    payload = verify_token(request)
    role = str(payload.get("role", "")).lower()
    if role not in ("customer", "user"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Customers only"
        )
    return payload


def get_current_admin(request: Request) -> dict:
    """Dependency: only allows role == 'admin'."""
    payload = verify_token(request)
    role = str(payload.get("role", "")).lower()
    if role not in ("admin", "internal"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admins only"
        )
    return payload
