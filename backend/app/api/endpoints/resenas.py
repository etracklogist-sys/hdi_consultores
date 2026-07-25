from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timezone

from app.db.database import get_db
from app.models.domain import ResenaCapacitacion, CapacitacionProgramada

router = APIRouter()

# --- Schemas ---

class ResenaCreate(BaseModel):
    programada_id: int
    estrellas: int  # 1-5
    comentario: Optional[str] = None

class ResenaOut(BaseModel):
    id: int
    estrellas: int
    comentario: Optional[str]
    created_at: str

# --- Endpoints ---

@router.post("/")
def crear_resena(payload: ResenaCreate, db: Session = Depends(get_db)):
    """Create an anonymous review for a training. No auth required — anonymity is the point."""
    
    if payload.estrellas < 1 or payload.estrellas > 5:
        raise HTTPException(400, "Las estrellas deben ser entre 1 y 5")
    
    prog = db.query(CapacitacionProgramada).filter(CapacitacionProgramada.id == payload.programada_id).first()
    if not prog:
        raise HTTPException(404, "Programada no encontrada")
    
    comentario = payload.comentario.strip()[:500] if payload.comentario else None
    
    resena = ResenaCapacitacion(
        programada_id=payload.programada_id,
        estrellas=payload.estrellas,
        comentario=comentario
    )
    db.add(resena)
    db.commit()
    db.refresh(resena)
    
    return {"id": resena.id, "message": "Reseña guardada. ¡Gracias por tu feedback!"}


@router.get("/{programada_id}")
def get_resenas(programada_id: int, db: Session = Depends(get_db)):
    """Get all anonymous reviews for a programada."""
    resenas = db.query(ResenaCapacitacion).filter(
        ResenaCapacitacion.programada_id == programada_id
    ).order_by(ResenaCapacitacion.created_at.desc()).all()
    
    total = len(resenas)
    promedio = sum(r.estrellas for r in resenas) / total if total > 0 else 0
    
    return {
        "total": total,
        "promedio": round(promedio, 1),
        "resenas": [
            {
                "id": r.id,
                "estrellas": r.estrellas,
                "comentario": r.comentario,
                "fecha": r.created_at.isoformat() if r.created_at else None
            }
            for r in resenas
        ]
    }
