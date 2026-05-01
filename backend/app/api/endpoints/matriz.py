from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.domain import RubroCapacitacion, Capacitacion, Rubro, Area
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()

class MatrizCreate(BaseModel):
    rubro_id: int
    area_id: int
    capacitacion_id: int
    obligatoria: bool = True

class MatrizResponse(BaseModel):
    id: int
    rubro_id: int
    rubro_nombre: str
    area_id: int
    area_nombre: str
    capacitacion_id: int
    capacitacion_nombre: str
    obligatoria: bool
    
    class Config:
        from_attributes = True

@router.get("/", response_model=List[MatrizResponse])
def get_matriz(db: Session = Depends(get_db)):
    rows = db.query(RubroCapacitacion).all()
    res = []
    for r in rows:
        rubro = db.query(Rubro).get(r.rubro_id)
        area = db.query(Area).get(r.area_id)
        cap = db.query(Capacitacion).get(r.capacitacion_id)
        # Avoid returning bad rows (e.g. empty area_id if legacy corrupted)
        if not rubro or not area or not cap:
            continue
        res.append({
            "id": r.id,
            "rubro_id": r.rubro_id,
            "rubro_nombre": rubro.nombre if rubro else "",
            "area_id": r.area_id,
            "area_nombre": area.nombre if area else "",
            "capacitacion_id": r.capacitacion_id,
            "capacitacion_nombre": cap.nombre if cap else "",
            "obligatoria": r.obligatoria
        })
    return res

def get_matriz_row(id: int, db: Session):
    r = db.query(RubroCapacitacion).get(id)
    rubro = db.query(Rubro).get(r.rubro_id)
    area = db.query(Area).get(r.area_id)
    cap = db.query(Capacitacion).get(r.capacitacion_id)
    return {
        "id": r.id,
        "rubro_id": r.rubro_id,
        "rubro_nombre": rubro.nombre if rubro else "",
        "area_id": r.area_id,
        "area_nombre": area.nombre if area else "",
        "capacitacion_id": r.capacitacion_id,
        "capacitacion_nombre": cap.nombre if cap else "",
        "obligatoria": r.obligatoria
    }

@router.post("/", response_model=MatrizResponse)
def create_matriz_row(item: MatrizCreate, db: Session = Depends(get_db)):
    ex = db.query(RubroCapacitacion).filter_by(rubro_id=item.rubro_id, area_id=item.area_id, capacitacion_id=item.capacitacion_id).first()
    if ex:
        raise HTTPException(status_code=400, detail="Esta combinación ya existe en la matriz")
    
    nuevo = RubroCapacitacion(**item.model_dump())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    
    return get_matriz_row(nuevo.id, db)

@router.delete("/{matriz_id}")
def delete_matriz_row(matriz_id: int, db: Session = Depends(get_db)):
    row = db.query(RubroCapacitacion).get(matriz_id)
    if not row:
         raise HTTPException(status_code=404)
    db.delete(row)
    db.commit()
    return {"status": "ok"}
    
class CapCreate(BaseModel):
    nombre: str

@router.get("/capacitaciones")
def get_capacitaciones(db: Session = Depends(get_db)):
    caps = db.query(Capacitacion).all()
    # Auto-seed basic ones if empty
    if not caps:
        default_caps = ["Manejo Defensivo", "Fatiga", "Uso de Extintores"]
        for c in default_caps:
            db.add(Capacitacion(nombre=c))
        db.commit()
        caps = db.query(Capacitacion).all()
        
    return [{"id": c.id, "nombre": c.nombre} for c in caps]

@router.post("/capacitaciones")
def create_capacitacione(item: CapCreate, db: Session = Depends(get_db)):
    if db.query(Capacitacion).filter_by(nombre=item.nombre).first():
        raise HTTPException(status_code=400, detail="Capacitacion ya existe")
    n = Capacitacion(nombre=item.nombre)
    db.add(n)
    db.commit()
    db.refresh(n)
    return {"id": n.id, "nombre": n.nombre}
