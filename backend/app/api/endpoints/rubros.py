from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.db.database import get_db
from app.models.domain import Rubro
from pydantic import BaseModel
from typing import List

router = APIRouter()

class RubroCreate(BaseModel):
    nombre: str

class RubroResponse(BaseModel):
    id: int
    nombre: str
    activo: bool

    class Config:
        from_attributes = True

@router.get("/", response_model=List[RubroResponse])
def get_rubros(db: Session = Depends(get_db)):
    rubros = db.query(Rubro).all()
    if not rubros:
        default_rubros = ["Transporte", "Logística", "Química", "Alimenticia", "Tecnología", "Servicios"]
        for nombre in default_rubros:
            db.add(Rubro(nombre=nombre, activo=True))
        db.commit()
        rubros = db.query(Rubro).all()
    return rubros

@router.post("/", response_model=RubroResponse)
def create_rubro(rubro: RubroCreate, db: Session = Depends(get_db)):
    db_rubro = Rubro(nombre=rubro.nombre.strip(), activo=True)
    db.add(db_rubro)
    try:
        db.commit()
        db.refresh(db_rubro)
        return db_rubro
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Ya existe un rubro con ese nombre.")

@router.put("/{rubro_id}", response_model=RubroResponse)
def update_rubro(rubro_id: int, rubro_update: RubroCreate, db: Session = Depends(get_db)):
    rubro = db.query(Rubro).filter(Rubro.id == rubro_id).first()
    if not rubro:
        raise HTTPException(status_code=404, detail="Rubro no encontrado")
    rubro.nombre = rubro_update.nombre.strip()
    try:
        db.commit()
        db.refresh(rubro)
        return rubro
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Ya existe un rubro con ese nombre.")

@router.put("/{rubro_id}/toggle")
def toggle_rubro(rubro_id: int, db: Session = Depends(get_db)):
    rubro = db.query(Rubro).filter(Rubro.id == rubro_id).first()
    if not rubro:
        raise HTTPException(status_code=404, detail="Rubro no encontrado")
    rubro.activo = not rubro.activo
    db.commit()
    return {"id": rubro.id, "activo": rubro.activo}

@router.delete("/{rubro_id}")
def delete_rubro(rubro_id: int, db: Session = Depends(get_db)):
    rubro = db.query(Rubro).filter(Rubro.id == rubro_id).first()
    if not rubro:
        raise HTTPException(status_code=404, detail="Rubro no encontrado")
    db.delete(rubro)
    db.commit()
    return {"message": "Rubro eliminado correctamente"}
