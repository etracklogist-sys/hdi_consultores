from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.db.database import get_db
from app.models.domain import Area
from pydantic import BaseModel
from typing import List

router = APIRouter()

class AreaCreate(BaseModel):
    nombre: str

class AreaResponse(BaseModel):
    id: int
    nombre: str
    activo: bool

    class Config:
        from_attributes = True

@router.get("/", response_model=List[AreaResponse])
def get_areas(db: Session = Depends(get_db)):
    areas = db.query(Area).all()
    if not areas:
        default_areas = ["Choferes", "Administración", "Depósito", "Operaciones", "Mantenimiento", "Producción"]
        for nombre in default_areas:
            db.add(Area(nombre=nombre, activo=True))
        db.commit()
        areas = db.query(Area).all()
    return areas

@router.post("/", response_model=AreaResponse)
def create_area(area: AreaCreate, db: Session = Depends(get_db)):
    db_area = Area(nombre=area.nombre.strip(), activo=True)
    db.add(db_area)
    try:
        db.commit()
        db.refresh(db_area)
        return db_area
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Ya existe un área con ese nombre.")

@router.put("/{area_id}", response_model=AreaResponse)
def update_area(area_id: int, area_update: AreaCreate, db: Session = Depends(get_db)):
    area = db.query(Area).filter(Area.id == area_id).first()
    if not area:
        raise HTTPException(status_code=404, detail="Área no encontrada")
    area.nombre = area_update.nombre.strip()
    try:
        db.commit()
        db.refresh(area)
        return area
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Ya existe un área con ese nombre.")

@router.put("/{area_id}/toggle")
def toggle_area(area_id: int, db: Session = Depends(get_db)):
    area = db.query(Area).filter(Area.id == area_id).first()
    if not area:
        raise HTTPException(status_code=404, detail="Área no encontrada")
    area.activo = not area.activo
    db.commit()
    return {"id": area.id, "activo": area.activo}

@router.delete("/{area_id}")
def delete_area(area_id: int, db: Session = Depends(get_db)):
    area = db.query(Area).filter(Area.id == area_id).first()
    if not area:
        raise HTTPException(status_code=404, detail="Área no encontrada")
    db.delete(area)
    db.commit()
    return {"message": "Área eliminada correctamente"}
