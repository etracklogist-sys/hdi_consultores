import os
from pydantic_settings import BaseSettings
from typing import Optional

# Helpers para leer la DB de Railway automáticamente
def get_db_url():
    # 1. Si pusiste DATABASE_URL a mano
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        return db_url
    
    # 2. Si Railway inyectó MYSQL_URL automáticamente
    mysql_url = os.getenv("MYSQL_URL")
    if mysql_url:
        # Reemplazar mysql:// por mysql+pymysql://
        if mysql_url.startswith("mysql://"):
            return mysql_url.replace("mysql://", "mysql+pymysql://", 1)
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
    BACKEND_CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]

    class Config:
        env_file = ".env"

settings = Settings()
