from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.domain import UsuarioConsultora
from app.core.security import get_current_user_uid
from pydantic import BaseModel

router = APIRouter()

class AdminFirmaRequest(BaseModel):
    firma_base64: str

@router.post("/firma")
def upload_admin_firma(req: AdminFirmaRequest, db: Session = Depends(get_db)):
    """Upload or update the admin/consultant digital signature."""
    admin = db.query(UsuarioConsultora).first()
    if not admin:
        raise HTTPException(status_code=404, detail="No hay usuario administrador registrado")
    
    admin.firma_base64 = req.firma_base64
    db.commit()
    return {"message": "Firma del administrador guardada correctamente"}

@router.get("/firma")
def get_admin_firma(db: Session = Depends(get_db)):
    """Get the admin/consultant digital signature."""
    admin = db.query(UsuarioConsultora).first()
    if not admin:
        return {"firma_base64": None}
    
    return {"firma_base64": admin.firma_base64}
