from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.domain import Capacitacion, Pregunta, Cliente
from pydantic import BaseModel
from typing import List, Optional
import json

router = APIRouter()

# ----------------- SCHEMAS -----------------

class CapacitacionCreate(BaseModel):
    nombre: str
    descripcion: str | None = None
    duracion_horas: int = 1
    modalidad: str = "presencial"
    requiere_evaluacion: bool = True
    puntaje_total: float = 10.0
    puntaje_aprobacion: float = 7.5
    meses_vigencia: int = 12
    rubro_id: int | None = None
    area_id: int | None = None

class CapacitacionResponse(BaseModel):
    id: int
    nombre: str
    descripcion: Optional[str] = None
    duracion_horas: Optional[int] = 1
    modalidad: Optional[str] = "presencial"
    requiere_evaluacion: Optional[bool] = True
    puntaje_total: Optional[float] = 10.0
    puntaje_aprobacion: Optional[float] = 7.5
    meses_vigencia: Optional[int] = 12
    rubro_id: Optional[int] = None
    area_id: Optional[int] = None
    rubro_nombre: Optional[str] = None
    area_nombre: Optional[str] = None
    activa: bool = True
    can_delete: bool | None = None
    can_deactivate: bool | None = None

    class Config:
        from_attributes = True

# ----------------- LIST / GET / CREATE -----------------

@router.get("/")
def get_capacitaciones(cliente_id: int = None, db: Session = Depends(get_db)):
    """List trainings. If cliente_id is provided, filter by client rubro + area compatibility."""
    query = db.query(Capacitacion)
    
    cliente = None
    if cliente_id:
        cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
        if cliente and cliente.rubro_id:
            # Rubro filter: match client rubro OR no rubro restriction
            query = query.filter(
                (Capacitacion.rubro_id == cliente.rubro_id) | (Capacitacion.rubro_id == None)
            )
    
    caps = query.all()
    
    # Post-filter by client areas (M2M) if client provided
    if cliente:
        client_area_ids = {a.id for a in cliente.areas}
        caps = [c for c in caps if not c.area_id or c.area_id in client_area_ids]
    
    from app.models.domain import CapacitacionProgramada, AsignacionCapacitacion, Pregunta, Certificado
    
    result = []
    for c in caps:
        has_history = (
            db.query(CapacitacionProgramada).filter(CapacitacionProgramada.capacitacion_id == c.id).first() is not None or
            db.query(AsignacionCapacitacion).filter(AsignacionCapacitacion.capacitacion_id == c.id).first() is not None or
            db.query(Pregunta).filter(Pregunta.capacitacion_id == c.id).first() is not None
        )
        can_delete = not has_history
        
        result.append({
            "id": c.id,
            "nombre": c.nombre,
            "descripcion": c.descripcion,
            "duracion_horas": c.duracion_horas,
            "modalidad": c.modalidad,
            "requiere_evaluacion": c.requiere_evaluacion,
            "puntaje_total": c.puntaje_total,
            "puntaje_aprobacion": c.puntaje_aprobacion,
            "meses_vigencia": c.meses_vigencia,
            "rubro_id": c.rubro_id,
            "area_id": c.area_id,
            "rubro_nombre": c.rubro.nombre if c.rubro else None,
            "area_nombre": c.area.nombre if c.area else None,
            "activa": c.activa,
            "can_delete": can_delete,
            "can_deactivate": not can_delete and c.activa
        })
    return result

@router.post("/")
def create_capacitacion(cap: CapacitacionCreate, db: Session = Depends(get_db)):
    # Validate: at least one of rubro_id or area_id must be set
    if not cap.rubro_id and not cap.area_id:
        raise HTTPException(status_code=400, detail="Debe asignar al menos un Rubro o un Área a la capacitación.")
    
    nueva = Capacitacion(**cap.model_dump())
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    
    return {
        "id": nueva.id,
        "nombre": nueva.nombre,
        "descripcion": nueva.descripcion,
        "duracion_horas": nueva.duracion_horas,
        "modalidad": nueva.modalidad,
        "requiere_evaluacion": nueva.requiere_evaluacion,
        "puntaje_total": nueva.puntaje_total,
        "puntaje_aprobacion": nueva.puntaje_aprobacion,
        "meses_vigencia": nueva.meses_vigencia,
        "rubro_id": nueva.rubro_id,
        "area_id": nueva.area_id,
        "rubro_nombre": nueva.rubro.nombre if nueva.rubro else None,
        "area_nombre": nueva.area.nombre if nueva.area else None,
    }

@router.get("/{capacitacion_id}")
def get_capacitacion(capacitacion_id: int, db: Session = Depends(get_db)):
    cap = db.query(Capacitacion).filter(Capacitacion.id == capacitacion_id).first()
    if not cap:
        raise HTTPException(status_code=404, detail="Capacitacion no encontrada")
    from app.models.domain import CapacitacionProgramada, AsignacionCapacitacion, Pregunta, Certificado
    
    has_history = (
        db.query(CapacitacionProgramada).filter(CapacitacionProgramada.capacitacion_id == cap.id).first() is not None or
        db.query(AsignacionCapacitacion).filter(AsignacionCapacitacion.capacitacion_id == cap.id).first() is not None or
        db.query(Pregunta).filter(Pregunta.capacitacion_id == cap.id).first() is not None
    )
    can_delete = not has_history
    
    return {
        "id": cap.id,
        "nombre": cap.nombre,
        "descripcion": cap.descripcion,
        "duracion_horas": cap.duracion_horas,
        "modalidad": cap.modalidad,
        "requiere_evaluacion": cap.requiere_evaluacion,
        "puntaje_total": cap.puntaje_total,
        "puntaje_aprobacion": cap.puntaje_aprobacion,
        "meses_vigencia": cap.meses_vigencia,
        "rubro_id": cap.rubro_id,
        "area_id": cap.area_id,
        "rubro_nombre": cap.rubro.nombre if cap.rubro else None,
        "area_nombre": cap.area.nombre if cap.area else None,
        "activa": cap.activa,
        "can_delete": can_delete,
        "can_deactivate": not can_delete and cap.activa
    }

class CapacitacionUpdate(BaseModel):
    nombre: str
    descripcion: str | None = None
    duracion_horas: int = 1
    modalidad: str = "presencial"
    rubro_id: int | None = None
    area_id: int | None = None

@router.put("/{capacitacion_id}")
def update_capacitacion(capacitacion_id: int, req: CapacitacionUpdate, db: Session = Depends(get_db)):
    cap = db.query(Capacitacion).filter(Capacitacion.id == capacitacion_id).first()
    if not cap:
        raise HTTPException(status_code=404, detail="Capacitacion no encontrada")
    
    cap.nombre = req.nombre
    cap.descripcion = req.descripcion
    cap.duracion_horas = req.duracion_horas
    cap.modalidad = req.modalidad
    cap.rubro_id = req.rubro_id
    cap.area_id = req.area_id
    
    db.commit()
    db.refresh(cap)
    
    return {
        "id": cap.id,
        "nombre": cap.nombre,
        "descripcion": cap.descripcion,
        "duracion_horas": cap.duracion_horas,
        "modalidad": cap.modalidad,
        "rubro_id": cap.rubro_id,
        "area_id": cap.area_id
    }

# ----------------- DELETION & ARCHIVING -----------------

@router.delete("/{capacitacion_id}")
def delete_capacitacion(capacitacion_id: int, db: Session = Depends(get_db)):
    cap = db.query(Capacitacion).filter(Capacitacion.id == capacitacion_id).first()
    if not cap:
        raise HTTPException(status_code=404, detail="Capacitacion no encontrada")
        
    from app.models.domain import CapacitacionProgramada, AsignacionCapacitacion, Pregunta
    has_history = (
        db.query(CapacitacionProgramada).filter(CapacitacionProgramada.capacitacion_id == cap.id).first() is not None or
        db.query(AsignacionCapacitacion).filter(AsignacionCapacitacion.capacitacion_id == cap.id).first() is not None or
        db.query(Pregunta).filter(Pregunta.capacitacion_id == cap.id).first() is not None
    )
    
    if has_history:
        raise HTTPException(status_code=400, detail="This entity cannot be deleted because it has operational history.")
        
    db.delete(cap)
    db.commit()
    return {"message": "Capacitación eliminada permanentemente"}

@router.patch("/{capacitacion_id}/desactivar")
def desactivar_capacitacion(capacitacion_id: int, db: Session = Depends(get_db)):
    cap = db.query(Capacitacion).filter(Capacitacion.id == capacitacion_id).first()
    if not cap:
        raise HTTPException(status_code=404, detail="Capacitacion no encontrada")
        
    cap.activa = False
    db.commit()
    return {"message": "Capacitación desactivada correctamente"}

# ----------------- CAPACITACION SETTINGS -----------------

class CapacitacionSettingsUpdate(BaseModel):
    requiere_evaluacion: bool
    puntaje_aprobacion: float
    meses_vigencia: int

@router.put("/{capacitacion_id}/settings")
def update_capacitacion_settings(capacitacion_id: int, req: CapacitacionSettingsUpdate, db: Session = Depends(get_db)):
    cap = db.query(Capacitacion).filter(Capacitacion.id == capacitacion_id).first()
    if not cap:
        raise HTTPException(status_code=404, detail="Capacitacion no encontrada")
        
    cap.requiere_evaluacion = req.requiere_evaluacion
    cap.puntaje_aprobacion = req.puntaje_aprobacion
    cap.meses_vigencia = req.meses_vigencia
    db.commit()
    db.refresh(cap)
    
    return {
        "id": cap.id,
        "requiere_evaluacion": cap.requiere_evaluacion,
        "puntaje_aprobacion": cap.puntaje_aprobacion,
        "meses_vigencia": cap.meses_vigencia
    }

@router.get("/{capacitacion_id}/settings")
def get_capacitacion_settings(capacitacion_id: int, db: Session = Depends(get_db)):
    cap = db.query(Capacitacion).filter(Capacitacion.id == capacitacion_id).first()
    if not cap:
        raise HTTPException(status_code=404, detail="Capacitacion no encontrada")
        
    return {
        "id": cap.id,
        "requiere_evaluacion": cap.requiere_evaluacion,
        "puntaje_aprobacion": cap.puntaje_aprobacion,
        "meses_vigencia": cap.meses_vigencia
    }

# ----------------- PREGUNTAS CRUD -----------------

class OpcionPregunta(BaseModel):
    id: int
    texto: str
    es_correcta: bool

class PreguntaCreate(BaseModel):
    texto: str
    opciones: List[OpcionPregunta]

class PreguntaResponse(BaseModel):
    id: int
    capacitacion_id: int
    texto: str
    opciones: List[OpcionPregunta]

@router.get("/{capacitacion_id}/preguntas", response_model=List[PreguntaResponse])
def get_preguntas_por_capacitacion(capacitacion_id: int, db: Session = Depends(get_db)):
    preguntas = db.query(Pregunta).filter(Pregunta.capacitacion_id == capacitacion_id).all()
    res = []
    for p in preguntas:
        opciones_parseadas = []
        if p.opciones_json:
            try:
                opciones_parseadas = json.loads(p.opciones_json)
            except:
                pass
        res.append({
            "id": p.id,
            "capacitacion_id": p.capacitacion_id,
            "texto": p.texto,
            "opciones": opciones_parseadas
        })
    return res

@router.post("/{capacitacion_id}/preguntas", response_model=PreguntaResponse)
def create_pregunta(capacitacion_id: int, req: PreguntaCreate, db: Session = Depends(get_db)):
    cap = db.query(Capacitacion).filter(Capacitacion.id == capacitacion_id).first()
    if not cap:
        raise HTTPException(status_code=404, detail="Capacitacion no encontrada")
        
    valid_correctas = [op for op in req.opciones if op.es_correcta]
    if len(valid_correctas) != 1:
        raise HTTPException(status_code=400, detail="Debe haber exactamente una opcion correcta")
        
    nueva = Pregunta(
        capacitacion_id=capacitacion_id,
        texto=req.texto,
        opciones_json=json.dumps([op.model_dump() for op in req.opciones])
    )
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    
    return {
        "id": nueva.id,
        "capacitacion_id": nueva.capacitacion_id,
        "texto": nueva.texto,
        "opciones": json.loads(nueva.opciones_json)
    }

@router.put("/preguntas/{pregunta_id}", response_model=PreguntaResponse)
def update_pregunta(pregunta_id: int, req: PreguntaCreate, db: Session = Depends(get_db)):
    pregunta = db.query(Pregunta).filter(Pregunta.id == pregunta_id).first()
    if not pregunta:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada")
        
    valid_correctas = [op for op in req.opciones if op.es_correcta]
    if len(valid_correctas) != 1:
        raise HTTPException(status_code=400, detail="Debe haber exactamente una opcion correcta")
        
    pregunta.texto = req.texto
    pregunta.opciones_json = json.dumps([op.model_dump() for op in req.opciones])
    
    db.commit()
    db.refresh(pregunta)
    
    return {
        "id": pregunta.id,
        "capacitacion_id": pregunta.capacitacion_id,
        "texto": pregunta.texto,
        "opciones": json.loads(pregunta.opciones_json)
    }

@router.delete("/preguntas/{pregunta_id}")
def delete_pregunta(pregunta_id: int, db: Session = Depends(get_db)):
    pregunta = db.query(Pregunta).filter(Pregunta.id == pregunta_id).first()
    if not pregunta:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada")
    
    db.delete(pregunta)
    db.commit()
    
    return {"message": "Pregunta eliminada"}
