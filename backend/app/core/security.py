from fastapi import HTTPException, Security, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.config import settings
import logging
import jwt
from datetime import datetime, timedelta, timezone

SECRET_KEY = settings.SECRET_KEY
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 días

security = HTTPBearer()

logger = logging.getLogger(__name__)


def create_access_token(data: dict) -> str:
    """Genera un JWT con los claims provistos y una expiración de 7 días."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    """Verifica cualquier JWT local válido (admin o empleado). Retorna el payload."""
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expirado. Vuelva a iniciar sesión.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o malformado.",
            headers={"WWW-Authenticate": "Bearer"},
        )


def require_admin(payload: dict = Depends(verify_token)) -> dict:
    """Dependency: solo permite tokens con role='admin'."""
    if payload.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso restringido: se requiere rol de administrador.",
        )
    return payload


def require_employee(payload: dict = Depends(verify_token)) -> dict:
    """Dependency: permite tokens de empleado_portal o admin."""
    role = payload.get("role")
    if role not in ("empleado_portal", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso restringido: se requiere autenticación de empleado.",
        )
    return payload


# ─── Aliases de compatibilidad para endpoints existentes ───

def verify_firebase_token(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    """Alias de compatibilidad — ahora valida JWT local en lugar de Firebase."""
    return verify_token(credentials)


def get_current_user_uid(payload: dict = Depends(verify_token)) -> str:
    return payload.get("uid") or payload.get("sub", "")


def get_current_user_email(payload: dict = Depends(verify_token)) -> str:
    return payload.get("email", "")
