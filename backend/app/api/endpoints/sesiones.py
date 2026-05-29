from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from datetime import datetime
from pydantic import BaseModel
from typing import List, Optional
from app.db.database import get_db
from app.models.domain import Sesion, SesionParticipante, Cliente, Capacitacion, Empleado, AsignacionCapacitacion, Evaluacion

router = APIRouter()

class SesionCreate(BaseModel):
    cliente_id: int
    capacitacion_id: int
    titulo_sesion: Optional[str] = None
    fecha_programada: datetime
    hora_programada: Optional[str] = None
    modalidad: str
    ubicacion: Optional[str] = None
    capacitador: Optional[str] = None
    observaciones: Optional[str] = None

class StatusUpdate(BaseModel):
    estado_sesion: str

class ParticipanteUpdate(BaseModel):
    asistio: bool
    estado_participacion: str
    nota: Optional[float] = None
    aprobado: Optional[bool] = None
    observaciones: Optional[str] = None

@router.post("/")
def create_session(session_data: SesionCreate, db: Session = Depends(get_db)):
    cliente = db.query(Cliente).filter(Cliente.id == session_data.cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
        
    cap = db.query(Capacitacion).filter(Capacitacion.id == session_data.capacitacion_id).first()
    if not cap:
        raise HTTPException(status_code=404, detail="Capacitación no encontrada")

    # 1. Store session
    nueva_sesion = Sesion(
        cliente_id=session_data.cliente_id,
        capacitacion_id=session_data.capacitacion_id,
        titulo_sesion=session_data.titulo_sesion or f"Sesión - {cap.nombre}",
        fecha_programada=session_data.fecha_programada,
        hora_programada=session_data.hora_programada,
        modalidad=session_data.modalidad,
        ubicacion=session_data.ubicacion,
        capacitador=session_data.capacitador,
        observaciones=session_data.observaciones,
        estado_sesion="programada",
        origen="manual"
    )
    db.add(nueva_sesion)
    db.commit()
    db.refresh(nueva_sesion)

    # 1b. Create Evaluacion implicitly if the Training requires it
    if cap.requiere_evaluacion:
        nueva_evaluacion = Evaluacion(
            sesion_id=nueva_sesion.id,
            activa=True
        )
        db.add(nueva_evaluacion)
        db.commit()

    # 2. Automatically detect eligible employees
    asignaciones_pendientes = db.query(AsignacionCapacitacion)\
        .join(Empleado, Empleado.id == AsignacionCapacitacion.empleado_id)\
        .filter(Empleado.cliente_id == session_data.cliente_id)\
        .filter(Empleado.activo == True)\
        .filter(AsignacionCapacitacion.capacitacion_id == session_data.capacitacion_id)\
        .filter(AsignacionCapacitacion.estado != "completada")\
        .all()
        
    # Deduplicate purely in code before inserting to avoid redundant logic
    procesados = set()
    participantes_creados = 0
    for asig in asignaciones_pendientes:
        if asig.empleado_id in procesados:
            continue
            
        procesados.add(asig.empleado_id)
        nuevo_part = SesionParticipante(
            sesion_id=nueva_sesion.id,
            empleado_id=asig.empleado_id,
            asignacion_id=asig.id,
            estado_participacion="convocado",
            asistio=False
        )
        db.add(nuevo_part)
        participantes_creados += 1
        
    db.commit()
    
    return {
        "message": "Sesión creada exitosamente", 
        "sesion_id": nueva_sesion.id, 
        "participantes_convocados": participantes_creados
    }

@router.get("/")
def list_sessions(
    cliente_id: Optional[int] = Query(None, description="Filtro opcional por cliente"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    query = db.query(Sesion)
    
    if cliente_id is not None:
        query = query.filter(Sesion.cliente_id == cliente_id)
        
    total = query.count()
    sesiones = query.order_by(Sesion.fecha_programada.desc()).offset(skip).limit(limit).all()
    
    res = []
    for s in sesiones:
        res.append({
            "id": s.id,
            "cliente_nombre": s.cliente.razon_social if s.cliente else "N/A",
            "capacitacion_nombre": s.capacitacion.nombre if s.capacitacion else "N/A",
            "fecha": s.fecha_programada.strftime("%Y-%m-%d"),
            "hora": s.hora_programada,
            "modalidad": s.modalidad,
            "estado": s.estado_sesion,
            "participantes_count": len(s.participantes)
        })
    return {"total": total, "items": res}

@router.get("/{sesion_id}")
def get_session_detail(sesion_id: int, db: Session = Depends(get_db)):
    sesion = db.query(Sesion).filter(Sesion.id == sesion_id).first()
    if not sesion:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
        
    header = {
        "id": sesion.id,
        "titulo": sesion.titulo_sesion,
        "cliente_nombre": sesion.cliente.razon_social if sesion.cliente else "",
        "capacitacion_nombre": sesion.capacitacion.nombre if sesion.capacitacion else "",
        "fecha": sesion.fecha_programada.strftime("%Y-%m-%d"),
        "hora": sesion.hora_programada,
        "modalidad": sesion.modalidad,
        "ubicacion": sesion.ubicacion,
        "capacitador": sesion.capacitador,
        "estado": sesion.estado_sesion,
        "observaciones": sesion.observaciones
    }
    
    parts = []
    for p in sesion.participantes:
        area_nombre = "N/A"
        if p.empleado and p.empleado.areas:
            area_nombre = ", ".join([a.nombre for a in p.empleado.areas])
            
        parts.append({
            "id": p.id,
            "empleado_id": p.empleado_id,
            "nombre_empleado": p.empleado.nombre_completo if p.empleado else "N/A",
            "area": area_nombre,
            "estado_participacion": p.estado_participacion,
            "asistio": p.asistio,
            "nota": p.nota,
            "aprobado": p.aprobado,
            "observaciones": p.observaciones
        })
        
    return {"header": header, "participantes": parts}

@router.put("/{sesion_id}/estado")
def update_session_status(sesion_id: int, req: StatusUpdate, db: Session = Depends(get_db)):
    sesion = db.query(Sesion).filter(Sesion.id == sesion_id).first()
    if not sesion:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
        
    if req.estado_sesion not in ["programada", "en_curso", "finalizada", "cancelada"]:
        raise HTTPException(status_code=400, detail="Estado inválido")
        
    sesion.estado_sesion = req.estado_sesion
    db.commit()
    return {"message": "Estado actualizado"}

@router.put("/{sesion_id}/participantes/{part_id}")
def update_participant(sesion_id: int, part_id: int, req: ParticipanteUpdate, db: Session = Depends(get_db)):
    part = db.query(SesionParticipante).filter(SesionParticipante.id == part_id, SesionParticipante.sesion_id == sesion_id).first()
    if not part:
        raise HTTPException(status_code=404, detail="Participante no encontrado")
        
    part.asistio = req.asistio
    part.estado_participacion = req.estado_participacion
    part.nota = req.nota
    part.aprobado = req.aprobado
    
    if req.observaciones is not None:
        part.observaciones = req.observaciones
        
    db.commit()

    # Flujo de Certificado para "Solo Asistencia"
    if req.asistio:
        sesion = db.query(Sesion).filter(Sesion.id == sesion_id).first()
        cap = sesion.capacitacion if sesion else None
        
        # Si NO requiere evaluación, emitir certificado por asistencia
        if cap and not cap.requiere_evaluacion:
            import hashlib
            from datetime import datetime, timezone
            from dateutil.relativedelta import relativedelta
            from app.models.domain import Certificado
            
            # Verificamos si no tiene ya el certificado
            cert_existente = db.query(Certificado).filter(Certificado.sesion_participante_id == part.id).first()
            if not cert_existente:
                meses_vigencia = cap.meses_vigencia if (cap and cap.meses_vigencia) else 12
                vencimiento = datetime.now(timezone.utc) + relativedelta(months=int(meses_vigencia))
                hash_string = f"{part.empleado_id}-att-{part.id}-{datetime.now().timestamp()}"
                hash_verificacion = hashlib.sha256(hash_string.encode()).hexdigest()

                # Freeze signatures at certificate creation time
                from app.models.domain import Empleado, UsuarioConsultora
                empleado_obj = db.query(Empleado).filter(Empleado.id == part.empleado_id).first()
                firma_empleado = empleado_obj.firma_base64 if empleado_obj else None
                
                # Get admin/trainer signature
                admin_user = db.query(UsuarioConsultora).filter(UsuarioConsultora.firma_base64 != None).first()
                firma_capacitador = admin_user.firma_base64 if admin_user else None

                certificado = Certificado(
                    empleado_id=part.empleado_id,
                    sesion_participante_id=part.id,
                    intento_id=None,
                    cliente_id=part.empleado.cliente_id if part.empleado else None,
                    capacitacion_id=cap.id,
                    hash_verificacion=hash_verificacion,
                    fecha_vencimiento=vencimiento,
                    estado="VIGENTE",
                    firma_empleado_snapshot=firma_empleado,
                    firma_capacitador_snapshot=firma_capacitador
                )
                db.add(certificado)
                db.commit()
    
    return {"message": "Participante actualizado exitosamente", "id": part.id}
class ParticipanteCreate(BaseModel):
    empleado_id: int

@router.post("/{sesion_id}/participantes")
def add_participant_to_session(sesion_id: int, req: ParticipanteCreate, db: Session = Depends(get_db)):
    sesion = db.query(Sesion).filter(Sesion.id == sesion_id).first()
    if not sesion:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")
        
    empleado = db.query(Empleado).filter(Empleado.id == req.empleado_id).first()
    if not empleado:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
        
    if empleado.cliente_id != sesion.cliente_id:
        raise HTTPException(status_code=400, detail="El empleado no pertenece al cliente organizador de esta sesión.")
        
    # Check if participant already exists via Integrity (query first explicitly to give friendly error)
    existente = db.query(SesionParticipante).filter(
        SesionParticipante.sesion_id == sesion_id, 
        SesionParticipante.empleado_id == req.empleado_id
    ).first()
    
    if existente:
        raise HTTPException(status_code=400, detail="El empleado ya está enrolled en esta sesión.")
        
    # Fetch assignation if any (optional nexus)
    asig = db.query(AsignacionCapacitacion).filter(
        AsignacionCapacitacion.empleado_id == req.empleado_id,
        AsignacionCapacitacion.capacitacion_id == sesion.capacitacion_id
    ).first()

    nuevo_part = SesionParticipante(
        sesion_id=sesion.id,
        empleado_id=empleado.id,
        asignacion_id=asig.id if asig else None,
        estado_participacion="convocado",
        asistio=False
    )
    db.add(nuevo_part)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="El empleado ya está inscrito.")
        
    return {"message": "Participante añadido", "participante_id": nuevo_part.id}
