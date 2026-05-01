import os
from pydantic_settings import BaseSettings
from typing import Optional

# Helpers para leer la DB de Railway automáticamente
def format_db_url(url: str | None) -> str | None:
    if url and url.startswith("mysql://"):
        return url.replace("mysql://", "mysql+pymysql://", 1)
    return url

def get_db_url():
    # 1. Si pusiste DATABASE_URL a mano (o por Reference Variable)
    db_url = format_db_url(os.getenv("DATABASE_URL"))
    if db_url:
        return db_url
    
    # 2. Si Railway inyectó MYSQL_URL automáticamente
    mysql_url = format_db_url(os.getenv("MYSQL_URL"))
    if mysql_url:
        return mysql_url
        
    # 3. Fallback local
    return "mysql+pymysql://root:password@127.0.0.1:3306/hdi_lms"

class Settings(BaseSettings):
    PROJECT_NAME: str = "HDI Consultores - Capacitaciones"
    API_V1_STR: str = "/api/v1"
    
    # MySQL local por defecto o inyectado por Railway
    DATABASE_URL: str = get_db_url()
    
    # Clave secreta para JWT (cambiar en producción)
    SECRET_KEY: str = "hdi_super_secret_jwt_key_changeme_in_production"

    # Configuración de entorno
    ENV: str = "development" # o "production"
    
    # CORS: en desarrollo incluye localhost, en producción setear solo la URL del frontend
    BACKEND_CORS_ORIGINS: list[str] | str = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

    from pydantic import field_validator
    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v: str | list[str]) -> list[str]:
        if isinstance(v, str):
            if v.startswith("["):
                import json
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

    class Config:
        env_file = ".env"

settings = Settings()
