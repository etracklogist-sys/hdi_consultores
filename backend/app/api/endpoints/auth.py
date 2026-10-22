from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.domain import Empleado, UsuarioConsultora
from app.core.security import create_access_token
from pydantic import BaseModel
import bcrypt
import re

router = APIRouter()

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def _dni_normalizado(valor) -> str:
    """DNI sin puntos, espacios, guiones ni otros separadores (incluidos los invisibles)."""
    limpio = re.sub(r"[^0-9A-Za-z]", "", str(valor or "")).upper()
    return limpio.lstrip("0") if limpio.isdigit() else limpio


def _buscar_por_dni_normalizado(db: Session, dni: str, empresa_id: int | None):
    """Busca el DNI ignorando el formato. El alta manual guarda el DNI tal cual se escribió
    (por ejemplo 18.375.057) y el empleado puede escribirlo con puntos o espacios."""
    buscado = _dni_normalizado(dni)
    if len(buscado) < 3:
        return []
    # Filtro grueso en la base: los últimos 3 caracteres quedan siempre juntos, aun con puntos.
    query = db.query(Empleado).filter(Empleado.dni.like(f"%{buscado[-3:]}%"))
    if empresa_id:
        query = query.filter(Empleado.cliente_id == int(empresa_id))
    return [e for e in query.all() if _dni_normalizado(e.dni) == buscado]

# ─── Schemas ────────────────────────────────────────────────

class DniAccessRequest(BaseModel):
    dni: str
    empresa_id: int | None = None
    email: str | None = None

class AdminLoginRequest(BaseModel):
    email: str
    password: str

# ─── Employee Login (DNI) ────────────────────────────────────

@router.post("/dni-access")
def dni_access(req: DniAccessRequest, db: Session = Depends(get_db)):
    input_dni = str(req.dni).strip()

    query = db.query(Empleado).filter(Empleado.dni == input_dni)
    if req.empresa_id:
        query = query.filter(Empleado.cliente_id == int(req.empresa_id))
        
    empleados = query.all()

    if not empleados:
        # Sin coincidencia exacta: se compara ignorando puntos, espacios y guiones.
        empleados = _buscar_por_dni_normalizado(db, input_dni, req.empresa_id)

    if not empleados:
        raise HTTPException(status_code=401, detail="DNI incorrecto o no registrado")
        
    if len(empleados) > 1 and not req.empresa_id:
        raise HTTPException(status_code=400, detail="El DNI está registrado en múltiples empresas. Contacte al administrador.")

    empleado = empleados[0]

    # Validación opcional por email
    if req.email and empleado.email and req.email.strip().lower() != empleado.email.strip().lower():
        raise HTTPException(status_code=401, detail="Las credenciales adicionales no coinciden")

    # Asegurar UID para mapeo interno
    token_uid = empleado.uid_firebase
    if not token_uid:
        token_uid = f"EMP-{empleado.id}"
        empleado.uid_firebase = token_uid
        db.commit()

    access_token = create_access_token(data={
        "uid": token_uid,
        "sub": str(empleado.id),
        "email": empleado.email,
        "role": "empleado_portal",
        "empleado_id": empleado.id,
    })

    # Get empresa name
    from app.models.domain import Cliente
    cliente = db.query(Cliente).filter(Cliente.id == empleado.cliente_id).first()

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "empleado": {
            "id": empleado.id,
            "nombre_completo": empleado.nombre_completo,
            "dni": empleado.dni,
            "email": empleado.email,
            "cliente_id": empleado.cliente_id,
            "empresa": cliente.razon_social if cliente else "Sin empresa"
        }
    }

# ─── Admin Login (Email + Password) ─────────────────────────

@router.post("/admin-login")
def admin_login(req: AdminLoginRequest, db: Session = Depends(get_db)):
    """Login de administrador con email y contraseña."""
    user = db.query(UsuarioConsultora).filter(
        UsuarioConsultora.email == req.email.strip().lower()
    ).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas"
        )

    if not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Este usuario no tiene contraseña configurada. Ejecute el script seed_admin.py."
        )

    if not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas"
        )

    access_token = create_access_token(data={
        "sub": str(user.id),
        "email": user.email,
        "role": "admin",
        "nombre": user.nombre,
    })

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "nombre": user.nombre,
            "email": user.email,
            "rol": user.rol,
        }
    }
