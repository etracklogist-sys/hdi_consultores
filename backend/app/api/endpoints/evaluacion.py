from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.domain import Intento, Evaluacion, Pregunta, Respuesta, Empleado, Certificado, AsignacionCapacitacion, Capacitacion, UsuarioConsultora
from app.core.security import get_current_user_uid
from datetime import datetime, timezone
from dateutil.relativedelta import relativedelta
from pydantic import BaseModel
import hashlib

router = APIRouter()

class IniciarEvaluacionRequest(BaseModel):
    asignacion_id: int

@router.post("/iniciar")
def iniciar_evaluacion_v2(req: IniciarEvaluacionRequest, current_uid: str = Depends(get_current_user_uid), db: Session = Depends(get_db)):
    """Inicia una evaluación para una asignación específica."""
    asignacion = db.query(AsignacionCapacitacion).filter(
        AsignacionCapacitacion.id == req.asignacion_id
    ).first()
    
    if not asignacion:
        raise HTTPException(status_code=404, detail="Asignación no encontrada")

    # Buscar o crear la Evaluación para esta asignación
    evaluacion = db.query(Evaluacion).filter(Evaluacion.asignacion_id == req.asignacion_id).first()
    if not evaluacion:
        evaluacion = Evaluacion(asignacion_id=req.asignacion_id, activa=True)
        db.add(evaluacion)
        db.commit()
        db.refresh(evaluacion)

    # Validar que no haya un intento EN_CURSO
    intento_activo = db.query(Intento).filter(
        Intento.asignacion_id == req.asignacion_id, 
        Intento.evaluacion_id == evaluacion.id,
        Intento.estado == "EN_CURSO"
    ).first()
    
    if intento_activo:
        return {
            "intento_id": intento_activo.id, 
            "mensaje": "Ya tienes un intento en curso", 
            "estado": "EN_CURSO",
            "id": intento_activo.id # Compatibilidad frontend
        }

    nuevo_intento = Intento(
        evaluacion_id=evaluacion.id,
        asignacion_id=req.asignacion_id,
        activo=True,
        estado="EN_CURSO",
        fecha_inicio=datetime.now(timezone.utc)
    )
    db.add(nuevo_intento)
    
    # Track evaluation start on assignment
    if not asignacion.evaluation_started_at:
        asignacion.evaluation_started_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(nuevo_intento)

    # Auto-generar Respuestas basadas exclusivamente en la capacitación asignada
    capacitacion_id = asignacion.capacitacion_id
    preguntas = db.query(Pregunta).filter(Pregunta.capacitacion_id == capacitacion_id).all()
    
    if not preguntas:
        # No permitir iniciar si no hay contenido evaluable
        db.delete(nuevo_intento)
        db.commit()
        raise HTTPException(status_code=400, detail="Esta capacitación no tiene preguntas configuradas.")

    for p in preguntas:
        db.add(Respuesta(
            intento_id=nuevo_intento.id,
            pregunta_id=p.id,
            opcion_elegida_id=None,
            es_correcta=None
        ))
    db.commit()

    return {"intento_id": nuevo_intento.id, "id": nuevo_intento.id, "status": "Iniciado"}

@router.get("/intentos/{intento_id}/preguntas")
def get_preguntas_intento(intento_id: int, current_uid: str = Depends(get_current_user_uid), db: Session = Depends(get_db)):
    """Retorna las preguntas configuradas específicamente para un intento."""
    import json
    
    intento = db.query(Intento).filter(Intento.id == intento_id).first()
    if not intento:
        raise HTTPException(status_code=404, detail="Intento no encontrado")

    # Obtener preguntas a través de las respuestas vinculadas
    respuestas = db.query(Respuesta).filter(Respuesta.intento_id == intento_id).all()
    if not respuestas:
        raise HTTPException(status_code=404, detail="No se encontraron preguntas para este intento")
    
    res = []
    for r in respuestas:
        p = db.query(Pregunta).filter(Pregunta.id == r.pregunta_id).first()
        if p:
            opciones = []
            if p.opciones_json:
                try:
                    opciones = json.loads(p.opciones_json)
                except:
                    pass
            res.append({
                "id": p.id,
                "texto": p.texto,
                "opciones": opciones,
                "respondida": r.opcion_elegida_id is not None,
                "opcion_elegida_id": r.opcion_elegida_id
            })
    return res

class ResponderRequest(BaseModel):
    intento_id: int
    pregunta_id: int
    opcion_elegida_id: int

@router.post("/responder")
def responder_pregunta(req: ResponderRequest, current_uid: str = Depends(get_current_user_uid), db: Session = Depends(get_db)):
    import json
    
    intento = db.query(Intento).filter(Intento.id == req.intento_id).first()
    if not intento:
        raise HTTPException(status_code=404, detail="Intento no encontrado")
    if intento.estado != "EN_CURSO":
        raise HTTPException(status_code=400, detail="El intento no está en curso")
        
    pregunta = db.query(Pregunta).filter(Pregunta.id == req.pregunta_id).first()
    if not pregunta:
        raise HTTPException(status_code=404, detail="Pregunta no encontrada")
        
    # Validate question belongs to the assignment's capacitacion
    asignacion = db.query(AsignacionCapacitacion).filter(AsignacionCapacitacion.id == intento.asignacion_id).first()
    if asignacion and pregunta.capacitacion_id != asignacion.capacitacion_id:
        raise HTTPException(status_code=400, detail="La pregunta no corresponde a esta evaluación")
        
    respuesta = db.query(Respuesta).filter(
        Respuesta.intento_id == req.intento_id,
        Respuesta.pregunta_id == req.pregunta_id
    ).first()
    
    if not respuesta:
        raise HTTPException(status_code=404, detail="Registro de respuesta no encontrado")
        
    opciones = json.loads(pregunta.opciones_json)
    es_correcta = False
    for opt in opciones:
        if opt.get("id") == req.opcion_elegida_id:
            es_correcta = opt.get("es_correcta", False)
            break
            
    respuesta.opcion_elegida_id = req.opcion_elegida_id
    respuesta.es_correcta = es_correcta
    db.commit()
    
    todas_resp = db.query(Respuesta).filter(Respuesta.intento_id == req.intento_id).all()
    total = len(todas_resp)
    respondidas = sum(1 for r in todas_resp if r.opcion_elegida_id is not None)
    porcentaje = (respondidas / total) * 100 if total > 0 else 0
    
    return {
        "pregunta_id": req.pregunta_id,
        "correcta": es_correcta,
        "progreso": {
            "total_preguntas": total,
            "respondidas": respondidas,
            "porcentaje_avance": round(porcentaje, 2)
        }
    }

class FinalizarIntentoRequest(BaseModel):
    intento_id: int

@router.post("/finalizar-intento")
def finalizar_intento_v2(req: FinalizarIntentoRequest, current_uid: str = Depends(get_current_user_uid), db: Session = Depends(get_db)):
    intento = db.query(Intento).filter(Intento.id == req.intento_id).first()
    if not intento:
        raise HTTPException(status_code=404, detail="Intento no encontrado")
    if intento.estado != "EN_CURSO":
        raise HTTPException(status_code=400, detail="El intento no está en curso o ya fue finalizado")
        
    respuestas = db.query(Respuesta).filter(Respuesta.intento_id == req.intento_id).all()
    if not respuestas:
        raise HTTPException(status_code=400, detail="No hay respuestas registradas")
        
    sin_responder = [r for r in respuestas if r.opcion_elegida_id is None]
    if sin_responder:
        raise HTTPException(
            status_code=400, 
            detail=f"Faltan {len(sin_responder)} preguntas por responder."
        )
        
    total_preguntas = len(respuestas)
    correctas = sum(1 for r in respuestas if r.es_correcta)
    incorrectas = total_preguntas - correctas
    porcentaje = (correctas / total_preguntas) * 100 if total_preguntas > 0 else 0
    nota = (correctas / total_preguntas) * 10 if total_preguntas > 0 else 0
    
    # Get threshold from capacitacion via assignment
    asignacion = db.query(AsignacionCapacitacion).filter(AsignacionCapacitacion.id == intento.asignacion_id).first()
    cap = asignacion.capacitacion if asignacion else None
    umbral = cap.puntaje_aprobacion if cap else 7.5
    esta_aprobado = nota >= umbral
    
    intento.nota_final = nota
    intento.aprobado = esta_aprobado
    intento.activo = False
    intento.estado = "FINALIZADO"
    intento.fecha_fin = datetime.now(timezone.utc)
    
    # Update tracking fields on assignment
    if asignacion:
        asignacion.evaluation_completed_at = datetime.now(timezone.utc)
        asignacion.evaluation_score = nota
        asignacion.evaluation_passed = esta_aprobado
        if esta_aprobado:
            asignacion.completed_at = datetime.now(timezone.utc)
            asignacion.completion_method = "EVALUATION"
            asignacion.asistio = True
    
    db.commit()
    
    # Certificate generation
    certificado_generado = False
    if esta_aprobado and asignacion:
        meses_vigencia = cap.meses_vigencia if cap else 12
        vencimiento = datetime.now(timezone.utc) + relativedelta(months=meses_vigencia)
        
        empleado_id = asignacion.empleado_id
        cliente_id = asignacion.cliente_id
        capacitacion_id = asignacion.capacitacion_id

        # Guard against duplicates
        cert_existente = db.query(Certificado).filter(
            Certificado.asignacion_id == asignacion.id
        ).first()
        
        if not cert_existente:
            hash_string = f"{empleado_id}-{intento.id}-{datetime.now().timestamp()}"
            hash_verificacion = hashlib.sha256(hash_string.encode()).hexdigest()

            # Freeze signatures at certificate creation time
            empleado_obj = db.query(Empleado).filter(Empleado.id == empleado_id).first()
            firma_empleado = empleado_obj.firma_base64 if empleado_obj else None
            
            # Get first admin user's signature as trainer/consultant signature
            admin_user = db.query(UsuarioConsultora).filter(UsuarioConsultora.firma_base64 != None).first()
            firma_capacitador = admin_user.firma_base64 if admin_user else None

            certificado = Certificado(
                empleado_id=empleado_id,
                asignacion_id=asignacion.id,
                intento_id=intento.id,
                cliente_id=cliente_id,
                capacitacion_id=capacitacion_id,
                hash_verificacion=hash_verificacion,
                fecha_vencimiento=vencimiento,
                estado="VIGENTE",
                firma_empleado_snapshot=firma_empleado,
                firma_capacitador_snapshot=firma_capacitador
            )
            db.add(certificado)
            
            # Update assignment status
            asignacion.estado = "aprobado"
            db.commit()
            certificado_generado = True
        else:
            certificado_generado = True
        
    return {
        "intento_id": intento.id,
        "estado": intento.estado,
        "total_preguntas": total_preguntas,
        "correctas": correctas,
        "incorrectas": incorrectas,
        "porcentaje": round(porcentaje, 2),
        "nota": round(nota, 2),
        "aprobado": esta_aprobado,
        "certificado_generado": certificado_generado
    }
