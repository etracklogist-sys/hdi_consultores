from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime

class EmpleadoBase(BaseModel):
    nombre_completo: str
    email: Optional[EmailStr] = None
    cliente_id: int
    activo: bool = True

class EmpleadoCreate(EmpleadoBase):
    pass

class EmpleadoResponse(EmpleadoBase):
    id: int
    uid_firebase: Optional[str] = None
    
    class Config:
        from_attributes = True

class IntentoBase(BaseModel):
    evaluacion_id: int
    empleado_id: int

class IntentoResponse(IntentoBase):
    id: int
    fecha_inicio: datetime
    fecha_fin: Optional[datetime]
    nota_final: Optional[float]
    aprobado: Optional[bool]
    activo: bool
    
    class Config:
        from_attributes = True

class RespuestaCreate(BaseModel):
    intento_id: int
    pregunta_id: int
    opcion_elegida_id: int
    
class CertificadoResponse(BaseModel):
    id: int
    hash_verificacion: str
    fecha_emision: datetime
    fecha_vencimiento: datetime
    
    class Config:
        from_attributes = True
