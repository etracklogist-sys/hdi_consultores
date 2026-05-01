from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.security import require_admin, require_employee
from app.db.database import engine, Base, SessionLocal
import logging
from app.models import domain

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Configurar CORS para el frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"status": "ok", "message": "API de Gestor de Capacitaciones HDI funcionando"}

# ─── Dependencias de seguridad por capa ─────────────────────
# Admin: requiere role='admin' en el JWT
_admin = [Depends(require_admin)]
# Empleado: requiere role='empleado_portal' o 'admin'
_employee = [Depends(require_employee)]

# Routers
from app.api.endpoints import (
    evaluacion, clientes, dashboard, empleados, vencimientos,
    auth, rubros, areas, capacitaciones, certificados,
    asignaciones, plan_anual, admin_profile
)

# ─── Rutas públicas (sin autenticación) ─────────────────────
app.include_router(auth.router,          prefix=settings.API_V1_STR + "/auth",          tags=["auth"])

# ─── Rutas de empleado (requieren token válido, cualquier rol) ─
# evaluacion usa get_current_user_uid internamente
app.include_router(evaluacion.router,         prefix=settings.API_V1_STR + "/evaluacion",    tags=["evaluaciones"])
# Endpoints /me/* del portal de empleado — sin require_admin
app.include_router(empleados.employee_router, prefix=settings.API_V1_STR + "/empleados",     tags=["empleado_portal"])

# ─── Rutas de administrador (requieren role=admin) ───────────
app.include_router(capacitaciones.router, prefix=settings.API_V1_STR + "/capacitaciones", tags=["capacitaciones"], dependencies=_admin)
app.include_router(areas.router,          prefix=settings.API_V1_STR + "/areas",          tags=["areas"],          dependencies=_admin)
app.include_router(rubros.router,         prefix=settings.API_V1_STR + "/rubros",         tags=["rubros"],         dependencies=_admin)
app.include_router(clientes.router,       prefix=settings.API_V1_STR + "/clientes",       tags=["clientes"],       dependencies=_admin)
app.include_router(dashboard.router,      prefix=settings.API_V1_STR + "/dashboard",      tags=["dashboard"],      dependencies=_admin)
app.include_router(empleados.router,      prefix=settings.API_V1_STR + "/empleados",      tags=["empleados"],      dependencies=_admin)
app.include_router(asignaciones.router,   prefix=settings.API_V1_STR + "/asignaciones",   tags=["asignaciones"],   dependencies=_admin)
app.include_router(vencimientos.router,   prefix=settings.API_V1_STR + "/vencimientos",   tags=["vencimientos"],   dependencies=_admin)
app.include_router(plan_anual.router,     prefix=settings.API_V1_STR + "/plan-anual",     tags=["plan_anual"],     dependencies=_admin)
app.include_router(admin_profile.router,  prefix=settings.API_V1_STR + "/admin/profile",  tags=["admin_profile"],  dependencies=_admin)

# Certificados: /verificar/{codigo} es público, /admin/list requiere admin
app.include_router(certificados.router,   prefix=settings.API_V1_STR + "/certificados",   tags=["certificados"])

# --- Startup Auto-Activation ---
@app.on_event("startup")
def startup_auto_activation():
    """
    On server startup, auto-activate all PROGRAMADA capacitaciones for the current month.
    This is idempotent — safe to run multiple times without side effects.
    """
    from app.api.endpoints.plan_anual import run_auto_activation
    logger.info("[STARTUP] Running auto-activation for current month...")
    db = SessionLocal()
    try:
        result = run_auto_activation(db)
        logger.info(f"[STARTUP] Auto-activation complete: {result}")
    except Exception as e:
        logger.error(f"[STARTUP] Auto-activation failed (non-fatal): {e}")
    finally:
        db.close()

# --- Startup Seed Admin ---
@app.on_event("startup")
def startup_seed_admin():
    """
    Ensure the default admin user exists on every server start.
    Idempotent — updates the existing user if already present.
    """
    import bcrypt
    from app.models.domain import UsuarioConsultora
    db = SessionLocal()
    try:
        email = "admin@hdiconsultores.com"
        existing = db.query(UsuarioConsultora).filter(
            UsuarioConsultora.email == email
        ).first()
        if not existing:
            hashed = bcrypt.hashpw("Admin2025!".encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
            nuevo = UsuarioConsultora(
                nombre="Administrador HDI",
                email=email,
                hashed_password=hashed,
                rol="ADMIN",
                uid_firebase=None,
            )
            db.add(nuevo)
            db.commit()
            logger.info(f"[STARTUP] Admin user created: {email}")
        else:
            logger.info(f"[STARTUP] Admin user already exists: {email}")
    except Exception as e:
        db.rollback()
        logger.error(f"[STARTUP] Seed admin failed (non-fatal): {e}")
    finally:
        db.close()

