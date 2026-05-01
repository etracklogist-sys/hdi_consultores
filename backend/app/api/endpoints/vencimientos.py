from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.database import get_db
from app.models.domain import Certificado, Empleado
from datetime import datetime, timezone
import pytz

router = APIRouter()

@router.get("/")
def get_vencimientos(db: Session = Depends(get_db)):
    """Obtiene los certificados y los clasifica en semáforo"""
    hoy = datetime.now(timezone.utc)
    
    certificados = db.query(Certificado, Empleado).join(Empleado).all()
    
    resultado = []
    
    for cert, emp in certificados:
        # Asegurarse de que ambos sean datetime con timezone
        if cert.fecha_vencimiento.tzinfo is None:
            vencimiento = pytz.utc.localize(cert.fecha_vencimiento)
        else:
            vencimiento = cert.fecha_vencimiento

        dias_restantes = (vencimiento - hoy).days
        
        estado = "Vigente"
        color = "green"
        if dias_restantes < 0:
            estado = "Vencido"
            color = "red"
        elif dias_restantes < 30:
            estado = "Próximo a Vencer"
            color = "amber"
            
        resultado.append({
            "id": cert.id,
            "empleado_nombre": emp.nombre_completo,
            "hash_certificado": cert.hash_verificacion,
            "fecha_vencimiento": vencimiento.isoformat(),
            "dias_restantes": dias_restantes,
            "estado": estado,
            "color": color
        })
        
    return resultado
