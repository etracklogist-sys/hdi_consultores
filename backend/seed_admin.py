"""
seed_admin.py - Crea o actualiza el usuario administrador en la base de datos.

Uso:
    cd backend
    python seed_admin.py

Credenciales por defecto:
    Email:    admin@hdiconsultores.com
    Password: Admin2025!

Cambia estas variables antes de ejecutar si queres usar otras credenciales.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.db.database import SessionLocal
from app.models.domain import UsuarioConsultora
import bcrypt

# --- Configuracion ---
ADMIN_NOMBRE   = "Administrador HDI"
ADMIN_EMAIL    = "admin@hdiconsultores.com"
ADMIN_PASSWORD = "Admin2025!"
# ---------------------

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def seed_admin():
    db = SessionLocal()
    try:
        existing = db.query(UsuarioConsultora).filter(
            UsuarioConsultora.email == ADMIN_EMAIL.strip().lower()
        ).first()

        hashed = hash_password(ADMIN_PASSWORD)

        if existing:
            existing.hashed_password = hashed
            existing.nombre = ADMIN_NOMBRE
            existing.rol = "ADMIN"
            db.commit()
            print("OK: Usuario admin actualizado:", ADMIN_EMAIL)
        else:
            nuevo = UsuarioConsultora(
                nombre=ADMIN_NOMBRE,
                email=ADMIN_EMAIL.strip().lower(),
                hashed_password=hashed,
                rol="ADMIN",
                uid_firebase=None,
            )
            db.add(nuevo)
            db.commit()
            db.refresh(nuevo)
            print("OK: Usuario admin creado (ID=%d): %s" % (nuevo.id, ADMIN_EMAIL))

        print("")
        print("Credenciales de acceso:")
        print("  Email:    " + ADMIN_EMAIL)
        print("  Password: " + ADMIN_PASSWORD)
        print("")
        print("IMPORTANTE: cambia la contrasena despues del primer login.")

    except Exception as e:
        db.rollback()
        print("ERROR:", e)
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_admin()
