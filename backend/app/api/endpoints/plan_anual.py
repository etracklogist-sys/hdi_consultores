from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import extract, and_
from fastapi.responses import Response
import csv
import io
import base64
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image as PlatypusImage, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.units import inch
from PIL import Image as PILImage
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
import logging

from app.db.database import get_db, SessionLocal
from app.core.security import get_current_user_uid
from app.models.domain import (
    PlanAnualCliente, PlanAnualItem, CapacitacionProgramada, 
    AsignacionCapacitacion, Cliente, Capacitacion, Empleado,
    Intento, Certificado
)

logger = logging.getLogger(__name__)

router = APIRouter()

# --- Pydantic Models ---

class PlanItemCreate(BaseModel):
    capacitacion_id: int
    mes: int
    tipo: str # ANUAL, COMPLEMENTARIA
    activo: bool = True

class ProgramadaUpdate(BaseModel):
    fecha_programada: str | None = None
    modalidad_final: str | None = None
    requiere_evaluacion_final: bool | None = None

class PlanAnualCreateUpdate(BaseModel):
    anio: int
    observaciones: Optional[str] = None
    items: List[PlanItemCreate]

class GenerarProgramadasResponse(BaseModel):
    creadas: int
    actualizadas: int

# --- Eligibility helpers (mirrored from asignaciones.py) ---

def _is_training_compatible_with_client(cap, cliente):
    """Check rubro + area compatibility between training and client."""
    if cap.rubro_id and cap.rubro_id != cliente.rubro_id:
        return False
    if cap.area_id:
        client_area_ids = {a.id for a in cliente.areas}
        if cap.area_id not in client_area_ids:
            return False
    return True

def _is_employee_eligible(emp, cap):
    """Check if employee is eligible for a training based on area (M2M)."""
    if not cap.area_id:
        return True  # No area restriction — all employees eligible
    return any(a.id == cap.area_id for a in emp.areas)

# --- Helper function to decouple assignment rules if possible ---
def trigger_asigacion_masiva(db: Session, programada: CapacitacionProgramada):
    """
    Encuentra empleados válidos (por cliente, rubro, área del curso)
    y les genera la AsignacionCapacitacion correspondiente si no la tienen en ESTA programada_id.
    Now includes area eligibility filtering to match asignaciones.py rules.
    """
    cliente = db.query(Cliente).get(programada.cliente_id)
    curso = db.query(Capacitacion).get(programada.capacitacion_id)
    
    if not cliente or not curso:
        return 0

    # Check client-level compatibility first
    if not _is_training_compatible_with_client(curso, cliente):
        logger.warning(f"Training {curso.nombre} incompatible with client {cliente.razon_social} (rubro/area mismatch)")
        return 0

    # Determinar empleados aplicables
    empleados_query = db.query(Empleado).filter(
        Empleado.cliente_id == programada.cliente_id,
        Empleado.activo == True
    )

    empleados_elegibles = empleados_query.all()
    
    # Filtrar por "alcance_asignacion" (TODOS vs SUBCONJUNTO)
    import json
    empleados_a_asignar = empleados_elegibles
    if programada.alcance_asignacion == "SUBCONJUNTO" and programada.empleados_incluidos:
        try:
            ids_incluidos = json.loads(programada.empleados_incluidos)
            empleados_a_asignar = [e for e in empleados_elegibles if e.id in ids_incluidos]
        except:
            pass

    asignados_count = 0
    for emp in empleados_a_asignar:
        # Area eligibility check — only assign if employee's areas match the training
        if not _is_employee_eligible(emp, curso):
            continue

        # Check explicit Uniqueness via programada_id (idempotent)
        existe = db.query(AsignacionCapacitacion).filter(
            AsignacionCapacitacion.empleado_id == emp.id,
            AsignacionCapacitacion.programada_id == programada.id
        ).first()
        
        if not existe:
            nueva = AsignacionCapacitacion(
                cliente_id=cliente.id,
                empleado_id=emp.id,
                capacitacion_id=curso.id,
                programada_id=programada.id,
                estado="pendiente",
                origen="anual_masiva" if programada.tipo in ["ANUAL", "COMPLEMENTARIA"] else "eventual_masiva"
            )
            db.add(nueva)
            asignados_count += 1
            
    db.commit()
    return asignados_count


# --- Standalone auto-activation function (for startup + endpoint use) ---

def run_auto_activation(db: Session):
    """
    Idempotent auto-activation: finds all PROGRAMADA (and legacy CERRADA) items
    for the current month/year and activates them + creates assignments.
    Safe to call multiple times — already-ACTIVA items are skipped.
    CERRADA is a deprecated legacy state that should be recovered to ACTIVA
    if it falls in the current month.
    """
    now = datetime.now(timezone.utc)
    current_month = now.month
    current_year = now.year
    
    pendientes = db.query(CapacitacionProgramada).filter(
        CapacitacionProgramada.mes == current_month,
        CapacitacionProgramada.anio == current_year,
        CapacitacionProgramada.estado.in_(["PROGRAMADA", "CERRADA"]),
        CapacitacionProgramada.tipo.in_(["ANUAL", "COMPLEMENTARIA"])
    ).all()
    
    total_asignaciones = 0
    activadas = 0
    for p in pendientes:
        if p.estado == "CERRADA":
            logger.info(f"[AUTO-ACTIVATION] Recovering legacy CERRADA row id={p.id} → ACTIVA")
        p.estado = "ACTIVA"
        p.fecha_activacion = now
        p.fecha_cierre = None  # Clear any incorrect close date from legacy state
        total_asignaciones += trigger_asigacion_masiva(db, p)
        activadas += 1
    
    db.commit()
    
    logger.info(f"[AUTO-ACTIVATION] Month {current_month}/{current_year}: {activadas} programadas activated, {total_asignaciones} assignments created.")
    return {
        "mes": current_month,
        "anio": current_year,
        "activadas": activadas,
        "asignaciones_generadas": total_asignaciones
    }


# --- Endpoints Principales ---

@router.get("/{cliente_id}/{anio}")
def get_plan_anual(cliente_id: int, anio: int, current_uid: str = Depends(get_current_user_uid), db: Session = Depends(get_db)):
    print(f"HIT GET /plan-anual/{cliente_id}/{anio} by {current_uid}")

    # ── Check for existing programadas regardless of plan existence ──
    programadas = db.query(CapacitacionProgramada).filter(
        CapacitacionProgramada.cliente_id == cliente_id,
        CapacitacionProgramada.anio == anio
    ).all()

    try:
        plan = db.query(PlanAnualCliente).filter(
            PlanAnualCliente.cliente_id == cliente_id,
            PlanAnualCliente.anio == anio
        ).first()
        
        if not plan and not programadas:
            # Truly empty — no plan AND no programadas
            return {"id": None, "cliente_id": cliente_id, "anio": anio, "estado": "NO_EXISTE", "items": [], "programadas": []}
        
        # ── AUTO-HYDRATE: Create plan from orphan programadas ──
        if not plan and programadas:
            logger.info(f"[HYDRATE] Creating plan from {len(programadas)} orphan programadas for client {cliente_id}, year {anio}")
            plan = PlanAnualCliente(
                cliente_id=cliente_id,
                anio=anio,
                estado="BORRADOR",
                observaciones="Plan generado automáticamente desde instancias existentes."
            )
            db.add(plan)
            db.flush()
            
            for p in programadas:
                existing_item = db.query(PlanAnualItem).filter(
                    PlanAnualItem.plan_anual_id == plan.id,
                    PlanAnualItem.capacitacion_id == p.capacitacion_id,
                    PlanAnualItem.mes == p.mes,
                    PlanAnualItem.tipo == p.tipo
                ).first()
                if not existing_item:
                    item = PlanAnualItem(
                        plan_anual_id=plan.id,
                        capacitacion_id=p.capacitacion_id,
                        mes=p.mes,
                        tipo=p.tipo,
                        activo=True
                    )
                    db.add(item)
                    # Link the programada back to the plan item
                    p.plan_item_id = None  # will be set after flush
                
            db.flush()
            # Now link programadas to their newly-created plan items
            for p in programadas:
                matching_item = db.query(PlanAnualItem).filter(
                    PlanAnualItem.plan_anual_id == plan.id,
                    PlanAnualItem.capacitacion_id == p.capacitacion_id,
                    PlanAnualItem.mes == p.mes,
                    PlanAnualItem.tipo == p.tipo
                ).first()
                if matching_item and not p.plan_item_id:
                    p.plan_item_id = matching_item.id
            
            db.commit()
            db.refresh(plan)
            logger.info(f"[HYDRATE] Plan {plan.id} created with {len(plan.items)} items")
        
        # ── SYNC: Plan exists but items are empty while programadas exist ──
        elif plan and len(plan.items) == 0 and programadas:
            logger.info(f"[SYNC] Plan {plan.id} has no items but {len(programadas)} programadas exist. Hydrating items.")
            for p in programadas:
                existing_item = db.query(PlanAnualItem).filter(
                    PlanAnualItem.plan_anual_id == plan.id,
                    PlanAnualItem.capacitacion_id == p.capacitacion_id,
                    PlanAnualItem.mes == p.mes,
                    PlanAnualItem.tipo == p.tipo
                ).first()
                if not existing_item:
                    item = PlanAnualItem(
                        plan_anual_id=plan.id,
                        capacitacion_id=p.capacitacion_id,
                        mes=p.mes,
                        tipo=p.tipo,
                        activo=True
                    )
                    db.add(item)
            db.commit()
            db.refresh(plan)

    except Exception as e:
        print(f"Error querying plan_anual: {str(e)}")
        raise HTTPException(500, detail="Error interno buscando el plan anual.")
        
    items = []
    for it in plan.items:
        items.append({
            "id": it.id,
            "capacitacion_id": it.capacitacion_id,
            "nombre_capacitacion": it.capacitacion.nombre if it.capacitacion else "Desconocida",
            "mes": it.mes,
            "tipo": it.tipo,
            "activo": it.activo
        })
    
    # Compute eligible employees for this client (once, reuse across programadas)
    all_active_employees = db.query(Empleado).filter(
        Empleado.cliente_id == cliente_id,
        Empleado.activo == True
    ).all()
    
    now = datetime.now(timezone.utc)
    current_month_val = now.month
    current_year_val = now.year
    
    # ── LAZY AUTO-ACTIVATION: Activate PROGRAMADA items for current or past months ──
    lazy_activated = False
    for p in programadas:
        if (p.estado == "PROGRAMADA" and p.anio == current_year_val and p.mes <= current_month_val):
            p.estado = "ACTIVA"
            p.fecha_activacion = now
            trigger_asigacion_masiva(db, p)
            logger.info(f"[LAZY-ACTIVATION] Auto-activated programada {p.id} ({p.mes}/{p.anio}) on GET request")
            lazy_activated = True
    
    if lazy_activated:
        db.commit()
        # Reload programadas to reflect new state + assignments
        programadas = db.query(CapacitacionProgramada).filter(
            CapacitacionProgramada.cliente_id == cliente_id,
            CapacitacionProgramada.anio == anio
        ).all()
    
    def _normalize_estado(p):
        """Normalize legacy CERRADA to a valid lifecycle state based on timing."""
        if p.estado != "CERRADA":
            return p.estado
        if (p.anio > current_year_val) or (p.anio == current_year_val and p.mes >= current_month_val):
            return "PROGRAMADA"
        return "FINALIZADA"
    
    prog_list = []
    for p in programadas:
        curso = p.capacitacion
        total_asignados = len(p.asignaciones)
        
        total_elegibles = 0
        if curso:
            total_elegibles = sum(1 for emp in all_active_employees if _is_employee_eligible(emp, curso))
        
        prog_list.append({
            "id": p.id,
            "capacitacion_id": p.capacitacion_id,
            "nombre": curso.nombre if curso else "Desconocida",
            "tipo": p.tipo,
            "mes": p.mes,
            "estado": _normalize_estado(p),
            "alcance": p.alcance_asignacion,
            "fecha_activacion": p.fecha_activacion.isoformat() if p.fecha_activacion else None,
            "fecha_programada": p.fecha_programada.isoformat() if p.fecha_programada else None,
            "fecha_cierre": p.fecha_cierre.isoformat() if p.fecha_cierre else None,
            "modalidad_final": p.modalidad_final,
            "requiere_evaluacion_final": p.requiere_evaluacion_final,
            "total_asignados": total_asignados,
            "total_elegibles": total_elegibles,
            "is_auto_activated": p.estado == "ACTIVA" and p.generada_automaticamente,
            "has_assignments": total_asignados > 0,
            "can_delete": p.estado == "PROGRAMADA" and total_asignados == 0,
            "can_activate_manual": p.estado == "PROGRAMADA",
            "can_cancel": p.estado in ("PROGRAMADA", "ACTIVA"),
            "can_finalize": p.estado == "ACTIVA"
        })

    return {
        "id": plan.id,
        "cliente_id": plan.cliente_id,
        "anio": plan.anio,
        "estado": plan.estado,
        "observaciones": plan.observaciones,
        "updated_at": plan.updated_at.isoformat() if plan.updated_at else None,
        "items": items,
        "programadas": prog_list
    }

@router.post("/{cliente_id}")
def upsert_plan_anual(cliente_id: int, payload: PlanAnualCreateUpdate, current_uid: str = Depends(get_current_user_uid), db: Session = Depends(get_db)):
    """Crea o actualiza el Plan Anual, y sus Items. Desencadena la generación idempotente de Programadas."""
    
    plan = db.query(PlanAnualCliente).filter(
        PlanAnualCliente.cliente_id == cliente_id,
        PlanAnualCliente.anio == payload.anio
    ).first()
    
    if not plan:
        plan = PlanAnualCliente(
            cliente_id=cliente_id,
            anio=payload.anio,
            estado="BORRADOR",
            observaciones=payload.observaciones
        )
        db.add(plan)
        db.commit()
        db.refresh(plan)
    else:
        plan.observaciones = payload.observaciones
        # Se elimina lo viejo para sincronizar fácil, ya que el historial vivo lo llevan las Programadas.
        db.query(PlanAnualItem).filter(PlanAnualItem.plan_anual_id == plan.id).delete()
        db.commit()

    # Regenerate items
    new_items = []
    for item_data in payload.items:
        it = PlanAnualItem(
            plan_anual_id=plan.id,
            capacitacion_id=item_data.capacitacion_id,
            mes=item_data.mes,
            tipo=item_data.tipo,
            activo=item_data.activo
        )
        new_items.append(it)
    
    if new_items:
        db.add_all(new_items)
        db.commit()

    # GENERACIÓN IDEMPOTENTE DE PROGRAMADAS
    creadas = 0
    actualizadas = 0
    errores = []
    
    # Recargamos la lista final (para que tengan su ID)
    items_final = db.query(PlanAnualItem).filter(PlanAnualItem.plan_anual_id == plan.id, PlanAnualItem.activo == True).all()
    
    logger.info(f"[REGENERATION] Plan {plan.id} for client {cliente_id}, year {payload.anio}: {len(items_final)} active items to process")
    
    for it in items_final:
        cap = it.capacitacion
        if not cap:
            logger.warning(f"[REGENERATION] Item {it.id} references capacitacion_id={it.capacitacion_id} which doesn't exist. Skipping.")
            errores.append(f"Item {it.id}: capacitación no encontrada")
            continue
        
        # Determine modalidad and evaluacion with guaranteed non-null defaults
        modalidad = it.modalidad_override or cap.modalidad or "presencial"
        requiere_eval = it.requiere_evaluacion_override if it.requiere_evaluacion_override is not None else (cap.requiere_evaluacion if cap.requiere_evaluacion is not None else True)
        
        # Verificar Idempotencia
        programada = db.query(CapacitacionProgramada).filter(
            CapacitacionProgramada.cliente_id == cliente_id,
            CapacitacionProgramada.capacitacion_id == it.capacitacion_id,
            CapacitacionProgramada.mes == it.mes,
            CapacitacionProgramada.anio == plan.anio,
            CapacitacionProgramada.tipo == it.tipo
        ).first()
        
        if programada:
            # Idempotent: Update link + metadata (do NOT change estado if already ACTIVA/FINALIZADA)
            programada.plan_item_id = it.id
            if programada.estado == "PROGRAMADA":
                programada.modalidad_final = modalidad
                programada.requiere_evaluacion_final = requiere_eval
            actualizadas += 1
            logger.info(f"[REGENERATION] Updated existing programada {programada.id} (estado={programada.estado}) for {cap.nombre} in month {it.mes}")
        else:
            # Create fresh — use SAVEPOINT so one failure doesn't kill the entire batch
            savepoint = db.begin_nested()
            try:
                # If adding a training to a past month, create it directly as FINALIZADA (Historical record)
                current_m = datetime.now(timezone.utc).month
                current_y = datetime.now(timezone.utc).year
                is_historical = (plan.anio < current_y) or (plan.anio == current_y and it.mes < current_m)
                
                initial_state = "FINALIZADA" if is_historical else "PROGRAMADA"
                
                nueva_prog = CapacitacionProgramada(
                    cliente_id=cliente_id,
                    capacitacion_id=it.capacitacion_id,
                    plan_item_id=it.id,
                    mes=it.mes,
                    anio=plan.anio,
                    tipo=it.tipo,
                    modalidad_final=modalidad,
                    requiere_evaluacion_final=requiere_eval,
                    estado=initial_state
                )
                if is_historical:
                    nueva_prog.fecha_activacion = datetime.now(timezone.utc)
                    nueva_prog.fecha_cierre = datetime.now(timezone.utc)
                
                db.add(nueva_prog)
                savepoint.commit()
                creadas += 1
                logger.info(f"[REGENERATION] Created new programada for {cap.nombre} in month {it.mes} (estado={initial_state})")
            except Exception as e:
                savepoint.rollback()
                logger.error(f"[REGENERATION] Failed to create programada for {cap.nombre} month {it.mes}: {str(e)}")
                errores.append(f"{cap.nombre} mes {it.mes}: {str(e)}")
            
    # Single final commit for all updates + new plan timestamp
    plan.updated_at = datetime.now(timezone.utc)
    db.commit()
    
    # ── AUTO-ACTIVATE: If any programada for the current month is still PROGRAMADA, activate it now ──
    now = datetime.now(timezone.utc)
    auto_activadas = 0
    auto_asignaciones = 0
    programadas_current_month = db.query(CapacitacionProgramada).filter(
        CapacitacionProgramada.cliente_id == cliente_id,
        CapacitacionProgramada.anio == now.year,
        CapacitacionProgramada.mes == now.month,
        CapacitacionProgramada.estado == "PROGRAMADA"
    ).all()
    
    for p in programadas_current_month:
        p.estado = "ACTIVA"
        p.fecha_activacion = now
        auto_asignaciones += trigger_asigacion_masiva(db, p)
        auto_activadas += 1
        logger.info(f"[AUTO-ACTIVATE-ON-SAVE] Activated programada {p.id} for current month")
    
    if auto_activadas > 0:
        db.commit()
        logger.info(f"[AUTO-ACTIVATE-ON-SAVE] {auto_activadas} programadas auto-activated, {auto_asignaciones} assignments created")
    
    logger.info(f"[REGENERATION] Done. Created={creadas}, Updated={actualizadas}, Errors={len(errores)}")
    
    return {
        "plan_id": plan.id,
        "saved_at": plan.updated_at.isoformat() if plan.updated_at else None,
        "generacion": {"creadas": creadas, "actualizadas": actualizadas},
        "auto_activadas": auto_activadas,
        "auto_asignaciones": auto_asignaciones,
        "errores": errores
    }

class ActivacionManualRequest(BaseModel):
    # Usado para EVENTUALES o activaciones aisladas de items del plan.
    programada_id: int
    alcance: str = "TODOS"
    empleados_ids: List[int] = []

@router.post("/programadas/activar")
def activar_programada(payload: ActivacionManualRequest, current_uid: str = Depends(get_current_user_uid), db: Session = Depends(get_db)):
    """
    IDEMPOTENT ACTIVATION: 
    Activa manualmente una Cap. Programada (p. ej. las EVENTUAL).
    Si ya estaba ACTIVA, la ignora (para prevenir doble disparo).
    """
    import json
    prog = db.query(CapacitacionProgramada).filter(CapacitacionProgramada.id == payload.programada_id).first()
    if not prog:
        raise HTTPException(404, "Programada no encontrada")
        
    if prog.estado in ("ACTIVA", "FINALIZADA", "CANCELADA"):
        return {"id": prog.id, "mensaje": f"Ignorado. El estado ya era {prog.estado}", "asignados": 0}
        
    prog.estado = "ACTIVA"
    prog.fecha_activacion = datetime.now(timezone.utc)
    prog.alcance_asignacion = payload.alcance
    prog.empleados_incluidos = json.dumps(payload.empleados_ids) if payload.empleados_ids else None
    
    asignados = trigger_asigacion_masiva(db, prog)
    return {"id": prog.id, "estado": "ACTIVA", "asignados": asignados}

@router.put("/programadas/{programada_id}")
def update_programada(programada_id: int, payload: ProgramadaUpdate, current_uid: str = Depends(get_current_user_uid), db: Session = Depends(get_db)):
    """
    Edita propiedades de la instancia.
    """
    prog = db.query(CapacitacionProgramada).filter(CapacitacionProgramada.id == programada_id).first()
    if not prog:
        raise HTTPException(404, "Programada no encontrada")
    
    if payload.fecha_programada is not None:
        if payload.fecha_programada == "":
            prog.fecha_programada = None
        else:
            prog.fecha_programada = datetime.fromisoformat(payload.fecha_programada.replace('Z', '+00:00'))
    
    if payload.modalidad_final is not None:
        prog.modalidad_final = payload.modalidad_final
        
    if payload.requiere_evaluacion_final is not None:
        prog.requiere_evaluacion_final = payload.requiere_evaluacion_final
        
    db.commit()
    db.refresh(prog)
    return {
        "id": prog.id,
        "fecha_programada": prog.fecha_programada.isoformat() if prog.fecha_programada else None,
        "modalidad_final": prog.modalidad_final,
        "requiere_evaluacion_final": prog.requiere_evaluacion_final
    }

@router.get("/programadas/{programada_id}/preview")
def preview_activacion(programada_id: int, current_uid: str = Depends(get_current_user_uid), db: Session = Depends(get_db)):
    """Dry-run para modal interactivo antes de consolidar asignaciones Masivas"""
    prog = db.query(CapacitacionProgramada).filter(CapacitacionProgramada.id == programada_id).first()
    if not prog: raise HTTPException(404, "Programada no encontrada")
    
    cliente = db.query(Cliente).get(prog.cliente_id)
    curso = db.query(Capacitacion).get(prog.capacitacion_id)
    if not cliente or not curso: raise HTTPException(400, "Inconsistencia de cliente o curso")
    
    empleados_query = db.query(Empleado).filter(Empleado.cliente_id == prog.cliente_id, Empleado.activo == True)
    elegibles = empleados_query.all()
    ya_asignados = 0
    nuevos_proyectados = 0
    
    # Check current assignments specific to THIS programada (Idempotent boundaries)
    for emp in elegibles:
        existe = db.query(AsignacionCapacitacion).filter(
            AsignacionCapacitacion.empleado_id == emp.id,
            AsignacionCapacitacion.programada_id == prog.id
        ).first()
        if existe:
            ya_asignados += 1
        else:
            nuevos_proyectados += 1
            
    return {
        "cliente": cliente.razon_social,
        "capacitacion": curso.nombre,
        "mes": prog.mes,
        "elegibles_totales": len(elegibles),
        "ya_asignados": ya_asignados,
        "nuevas_asignaciones": nuevos_proyectados
    }

@router.get("/auto-activate")
def auto_activate_current_month(current_uid: str = Depends(get_current_user_uid), db: Session = Depends(get_db)):
    """
    Idempotent auto-activation endpoint.
    Activates all PROGRAMADA items for the current month/year and creates assignments.
    Safe to call multiple times — already-ACTIVA items are skipped.
    """
    result = run_auto_activation(db)
    return result

@router.post("/activar-mes/{mes}/{anio}")
def cron_activar_mes(mes: int, anio: int, current_uid: str = Depends(get_current_user_uid), db: Session = Depends(get_db)):
    """
    Simula o ejecuta la rutina de comienzo de mes.
    Busca TODAS las programadas pendientes de ese mes y las dispara.
    """
    pendientes = db.query(CapacitacionProgramada).filter(
        CapacitacionProgramada.mes == mes,
        CapacitacionProgramada.anio == anio,
        CapacitacionProgramada.estado == "PROGRAMADA",
        CapacitacionProgramada.tipo.in_(["ANUAL", "COMPLEMENTARIA"])
    ).all()
    
    total_asignaciones = 0
    activadas = 0
    for p in pendientes:
        p.estado = "ACTIVA"
        p.fecha_activacion = datetime.now(timezone.utc)
        total_asignaciones += trigger_asigacion_masiva(db, p)
        activadas += 1
        
    db.commit()
    return {"mes": mes, "activadas": activadas, "asignaciones_generadas": total_asignaciones}

# NOTE: /cerrar/ endpoint REMOVED. Use /finalizar or /cancelar instead.
# CERRADA state is deprecated — only FINALIZADA and CANCELADA are valid terminal states.

@router.post("/programadas/{programada_id}/finalizar")
def finalizar_programada(programada_id: int, current_uid: str = Depends(get_current_user_uid), db: Session = Depends(get_db)):
    """Transitions an ACTIVA programada to FINALIZADA."""
    prog = db.query(CapacitacionProgramada).filter(CapacitacionProgramada.id == programada_id).first()
    if not prog:
        raise HTTPException(404, "Programada no encontrada")
    if prog.estado != "ACTIVA":
        raise HTTPException(400, f"Solo se puede finalizar una instancia ACTIVA. Estado actual: {prog.estado}")
    prog.estado = "FINALIZADA"
    prog.fecha_cierre = datetime.now(timezone.utc)
    db.commit()
    return {"id": programada_id, "estado": "FINALIZADA"}

@router.patch("/programadas/{programada_id}/cancelar")
def cancelar_programada(programada_id: int, current_uid: str = Depends(get_current_user_uid), db: Session = Depends(get_db)):
    """Cancels a programada. Does NOT delete data. Sets estado = CANCELADA."""
    prog = db.query(CapacitacionProgramada).filter(CapacitacionProgramada.id == programada_id).first()
    if not prog:
        raise HTTPException(404, "Programada no encontrada")
    if prog.estado not in ("PROGRAMADA", "ACTIVA"):
        raise HTTPException(400, f"No se puede cancelar una instancia con estado: {prog.estado}")
    prog.estado = "CANCELADA"
    prog.fecha_cierre = datetime.now(timezone.utc)
    db.commit()
    return {"id": programada_id, "estado": "CANCELADA"}

@router.delete("/programadas/{programada_id}")
def delete_programada(programada_id: int, current_uid: str = Depends(get_current_user_uid), db: Session = Depends(get_db)):
    """Deletes a programada ONLY if estado == PROGRAMADA and no assignments exist."""
    prog = db.query(CapacitacionProgramada).filter(CapacitacionProgramada.id == programada_id).first()
    if not prog:
        raise HTTPException(404, "Programada no encontrada")
    if prog.estado != "PROGRAMADA":
        raise HTTPException(400, f"Solo se puede eliminar una instancia PROGRAMADA. Estado actual: {prog.estado}. Use 'Cancelar' en su lugar.")
    assignment_count = db.query(AsignacionCapacitacion).filter(AsignacionCapacitacion.programada_id == programada_id).count()
    if assignment_count > 0:
        raise HTTPException(400, f"No se puede eliminar: tiene {assignment_count} asignaciones existentes. Use 'Cancelar' en su lugar.")
    db.delete(prog)
    db.commit()
    return {"id": programada_id, "eliminada": True}

class EventualCreateRequest(BaseModel):
    cliente_id: int
    capacitacion_id: int
    anio: int 
    mes: int

@router.post("/eventual")
def crear_eventual(payload: EventualCreateRequest, current_uid: str = Depends(get_current_user_uid), db: Session = Depends(get_db)):
    """Crea una capacitación EVENTUAL. No depende del Plan. Requiere validación."""
    cap = db.query(Capacitacion).filter(Capacitacion.id == payload.capacitacion_id).first()
    if not cap:
        raise HTTPException(400, "Capacitación no encontrada en Catálogo")
        
    # Idempotency para la eventual si casualmente envían mismo request dos veces
    existe = db.query(CapacitacionProgramada).filter(
        CapacitacionProgramada.cliente_id == payload.cliente_id,
        CapacitacionProgramada.capacitacion_id == payload.capacitacion_id,
        CapacitacionProgramada.mes == payload.mes,
        CapacitacionProgramada.anio == payload.anio,
        CapacitacionProgramada.tipo == "EVENTUAL"
    ).first()
    
    if existe:
        return {"id": existe.id, "mensaje": "Ya existe una eventual igual", "estado": existe.estado}
        
    prog = CapacitacionProgramada(
        cliente_id=payload.cliente_id,
        capacitacion_id=payload.capacitacion_id,
        plan_item_id=None,
        mes=payload.mes,
        anio=payload.anio,
        tipo="EVENTUAL",
        modalidad_final=cap.modalidad,
        requiere_evaluacion_final=cap.requiere_evaluacion,
        estado="PROGRAMADA",
        generada_automaticamente=False
    )
    db.add(prog)
    db.commit()
    db.refresh(prog)
    return {"id": prog.id, "estado": prog.estado, "mensaje": "Creada EVENTUAL en estado PROGRAMADA. Esperando activación."}


# ═══════════════════════════════════════════════════════════════
# EMPLOYEE MANAGEMENT WITHIN A PROGRAMADA
# ═══════════════════════════════════════════════════════════════

@router.get("/programadas/{programada_id}/export-participantes")
def export_programada_participantes(programada_id: int, current_uid: str = Depends(get_current_user_uid), db: Session = Depends(get_db)):
    """Exports assigned participants as a CSV file with detailed completion and certification metrics."""
    prog = db.query(CapacitacionProgramada).filter(CapacitacionProgramada.id == programada_id).first()
    if not prog:
        raise HTTPException(404, "Programada no encontrada")

    asignaciones = db.query(AsignacionCapacitacion).filter(
        AsignacionCapacitacion.programada_id == programada_id
    ).all()

    output = io.StringIO()
    writer = csv.writer(output, delimiter=',', quotechar='"', quoting=csv.QUOTE_MINIMAL)
    
    # Headers
    writer.writerow([
        "Nombre", "DNI", "Área", "Estado", "Nota", "Fecha completado",
        "Método de cumplimiento", "Tiene firma empleado", "Certificado emitido", "Firma capacitador", "Código de Verificación"
    ])

    for a in asignaciones:
        emp = a.empleado
        if not emp:
            continue
            
        area_nombre = emp.areas[0].nombre if emp.areas else "Sin área"
        
        # Determine "Nota" from Intento if applicable
        nota = "N/A"
        ultimo_intento = db.query(Intento).filter(Intento.asignacion_id == a.id).order_by(Intento.nota_final.desc()).first()
        if ultimo_intento and ultimo_intento.nota_final is not None:
            nota = str(round(ultimo_intento.nota_final, 1))
            
        # Completion Method translation
        metodo = a.completion_method or "Pendiente"
        
        # Certificado
        cert = db.query(Certificado).filter(Certificado.asignacion_id == a.id).first()
        cert_emitido = "SI" if cert else "NO"
        hash_cert = cert.hash_verificacion if cert else ""
        tiene_firma_emp = "SI" if cert and cert.firma_empleado_snapshot else "NO"
        tiene_firma_cap = "SI" if cert and cert.firma_capacitador_snapshot else "NO"
        
        # Employee signature fallback to base field if not certified yet
        if not cert and emp.firma_base64:
            tiene_firma_emp = "SI (Perfil)"
            
        fecha_completado = a.completed_at.strftime('%Y-%m-%d %H:%M:%S') if a.completed_at else "N/A"
        
        writer.writerow([
            emp.nombre_completo,
            emp.dni or "N/A",
            area_nombre,
            a.estado.upper(),
            nota,
            fecha_completado,
            metodo,
            tiene_firma_emp,
            cert_emitido,
            tiene_firma_cap,
            hash_cert
        ])

    csv_data = output.getvalue()
    # Add BOM for Excel UTF-8 display
    csv_data_with_bom = '\ufeff' + csv_data
    
    return Response(
        content=csv_data_with_bom,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="participantes_programada_{programada_id}.csv"'}
    )

@router.get("/programadas/{programada_id}/acta-pdf")
def export_programada_acta_pdf(programada_id: int, current_uid: str = Depends(get_current_user_uid), db: Session = Depends(get_db)):
    """Generates a formal PDF Audit Document spanning multiple pages if necessary."""
    from app.models.domain import UsuarioConsultora
    prog = db.query(CapacitacionProgramada).filter(CapacitacionProgramada.id == programada_id).first()
    if not prog:
        raise HTTPException(404, "Programada no encontrada")

    asignaciones = db.query(AsignacionCapacitacion).filter(
        AsignacionCapacitacion.programada_id == programada_id
    ).all()
    
    cliente = db.query(Cliente).get(prog.cliente_id)
    curso = db.query(Capacitacion).get(prog.capacitacion_id)
    
    # Extract Trainer Signature
    admin_user = db.query(UsuarioConsultora).filter(UsuarioConsultora.firma_base64 != None).first()
    trainer_sig = admin_user.firma_base64 if admin_user else None
    
    output = io.BytesIO()
    # A4 landscape for wide tables
    doc = SimpleDocTemplate(output, pagesize=landscape(A4),
                            rightMargin=30, leftMargin=30,
                            topMargin=30, bottomMargin=30)
    
    elements = []
    styles = getSampleStyleSheet()
    
    # Custom Styles
    style_title = ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        alignment=TA_CENTER,
        fontSize=18,
        spaceAfter=20
    )
    style_normal = styles['Normal']
    style_bold = ParagraphStyle('BoldNormal', parent=style_normal, fontName='Helvetica-Bold')

    # --- Header Section ---
    elements.append(Paragraph("REGISTRO DE PARTICIPANTES / ACTA DE CAPACITACIÓN", style_title))
    
    header_data = [
        [Paragraph("<b>Cliente:</b>", style_bold), cliente.razon_social if cliente else "N/A", 
         Paragraph("<b>Fecha Programada:</b>", style_bold), prog.fecha_programada.strftime('%d/%m/%Y') if prog.fecha_programada else "N/A"],
        [Paragraph("<b>Capacitación:</b>", style_bold), curso.nombre if curso else "N/A", 
         Paragraph("<b>Modalidad:</b>", style_bold), prog.modalidad_final or "N/A"],
        [Paragraph("<b>Mes/Año:</b>", style_bold), f"{prog.mes}/{prog.anio}", 
         Paragraph("<b>Estado:</b>", style_bold), prog.estado],
        [Paragraph("<b>Tipo:</b>", style_bold), prog.tipo, 
         Paragraph("<b>Fecha de Emisión del Acta:</b>", style_bold), datetime.now().strftime('%d/%m/%Y %H:%M')],
        [Paragraph("<b>Responsable / Instructor:</b>", style_bold), "HDI Consultores", "", ""]
    ]
    
    t_header = Table(header_data, colWidths=[1.5*inch, 3*inch, 2*inch, 2*inch])
    t_header.setStyle(TableStyle([
        ('FONTNAME', (0,0), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,0), (-1,-1), 10),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
    ]))
    elements.append(t_header)
    elements.append(Spacer(1, 20))
    
    # --- Main Participants Table ---
    table_data = [[
        "Nombre y Apellido", "DNI", "Área", "Estado", 
        "Asistencia", "Nota", "Resultado", "Método"
    ]]
    
    is_presencial = prog.modalidad_final and 'presencial' in prog.modalidad_final.lower()
    for a in asignaciones:
        emp = a.empleado
        if not emp: continue
        area_nombre = emp.areas[0].nombre if emp.areas else "Sin área"
        
        nota = "-"
        ultimo_intento = db.query(Intento).filter(Intento.asignacion_id == a.id).order_by(Intento.nota_final.desc()).first()
        if ultimo_intento and ultimo_intento.nota_final is not None:
            nota = str(round(ultimo_intento.nota_final, 1))
            
        asistio_virtual = (not is_presencial) and a.estado == "aprobado"
        asistencia = "Sí" if a.asistio or asistio_virtual else "No"
        resultado_txt = "Aprobado" if a.estado == "aprobado" else a.estado.capitalize()
        metodo = a.completion_method or "-"
        
        table_data.append([
            emp.nombre_completo,
            emp.dni or "-",
            area_nombre,
            a.estado.upper(),
            asistencia,
            nota,
            resultado_txt,
            metodo
        ])
        
    t_main = Table(table_data, repeatRows=1)
    t_main.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#f1f5f9")),
        ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor("#1e293b")),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('ALIGN', (0,1), (0,-1), 'LEFT'),  # Left align names
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 10),
        ('FONTNAME', (0,1), (-1,-1), 'Helvetica'),
        ('FONTSIZE', (0,1), (-1,-1), 9),
        ('BOTTOMPADDING', (0,0), (-1,0), 12),
        ('TOPPADDING', (0,0), (-1,0), 12),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#cbd5e1")),
    ]))
    elements.append(t_main)
    
    # --- Signatures Appendix ---
    elements.append(PageBreak())
    elements.append(Paragraph("ANEXO: FIRMAS DE PARTICIPANTES", style_title))
    elements.append(Spacer(1, 10))
    
    def _create_platypus_image(b64_str, max_w, max_h):
        if not b64_str:
            return Paragraph("<i>Sin firma registrada</i>", style_normal)
        try:
            raw = b64_str.split(",")[-1]
            img_data = base64.b64decode(raw)
            img_io = io.BytesIO(img_data)
            img = PILImage.open(img_io)
            w, h = img.size
            scale = min(max_w/w, max_h/h, 1.0)
            img_io.seek(0)
            return PlatypusImage(img_io, width=w*scale, height=h*scale)
        except Exception:
            return Paragraph("<i>Error al cargar firma</i>", style_normal)

    # 3-column layout for participant signatures
    sig_data = []
    current_row = []
    
    for a in asignaciones:
        emp = a.empleado
        if not emp: continue
        
        # Prioritize certificate snapshot, fallback to profile signature
        cert = db.query(Certificado).filter(Certificado.asignacion_id == a.id).first()
        b64_sig = None
        if cert and cert.firma_empleado_snapshot:
            b64_sig = cert.firma_empleado_snapshot
        elif emp.firma_base64:
            b64_sig = emp.firma_base64
            
        style_center = ParagraphStyle('Center', parent=style_normal, alignment=TA_CENTER)
        p_name = Paragraph(f"<b>{emp.nombre_completo}</b><br/>DNI: {emp.dni or '-'}", style_center)
        p_img = _create_platypus_image(b64_sig, 2*inch, 1*inch)
        
        # Build cell containing Name + Signature
        cell_table = Table([[p_name], [p_img]], colWidths=[2.5*inch])
        cell_table.setStyle(TableStyle([
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('TOPPADDING', (0,0), (-1,-1), 10),
            ('BOTTOMPADDING', (0,0), (-1,-1), 10),
        ]))
        
        current_row.append(cell_table)
        
        if len(current_row) == 3:
            sig_data.append(current_row)
            current_row = []
            
    if current_row:
        # pad remaining cells
        while len(current_row) < 3:
            current_row.append("")
        sig_data.append(current_row)
        
    if sig_data:
        t_sigs = Table(sig_data, colWidths=[3*inch, 3*inch, 3*inch], spaceBefore=20)
        t_sigs.setStyle(TableStyle([
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor("#e2e8f0")),
            ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
            ('ALIGN', (0,0), (-1,-1), 'CENTER')
        ]))
        elements.append(t_sigs)
    else:
        elements.append(Paragraph("No hay participantes asignados.", style_normal))
        
    # --- Trainer Signature at the bottom ---
    elements.append(Spacer(1, 40))
    trainer_img = _create_platypus_image(trainer_sig, 2.5*inch, 1.2*inch)
    trainer_info = Paragraph("<b>HDI Consultores</b><br/>Instructor / Representante", ParagraphStyle('CenterBold', parent=style_normal, alignment=TA_CENTER))
    
    trainer_table = Table([[trainer_img], [trainer_info]], colWidths=[3*inch])
    trainer_table.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
    ]))
    
    # Put the trainer table aligned to the right or center. Center looks formal.
    container = Table([["", trainer_table]], colWidths=[5*inch, 3.5*inch])
    container.setStyle(TableStyle([('ALIGN', (1,0), (1,0), 'RIGHT')]))
    
    elements.append(container)
    
    doc.build(elements)
    
    pdf_data = output.getvalue()
    return Response(
        content=pdf_data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="ActaCapacitacion_{programada_id}.pdf"'}
    )

@router.get("/programadas/{programada_id}/empleados")
def get_programada_empleados(programada_id: int, current_uid: str = Depends(get_current_user_uid), db: Session = Depends(get_db)):
    """Returns assigned AND eligible-not-assigned employees for a programada."""
    prog = db.query(CapacitacionProgramada).filter(CapacitacionProgramada.id == programada_id).first()
    if not prog:
        raise HTTPException(404, "Programada no encontrada")
    
    curso = db.query(Capacitacion).get(prog.capacitacion_id)
    if not curso:
        raise HTTPException(400, "Capacitación no encontrada")
    
    # Get all active employees for this client
    all_employees = db.query(Empleado).filter(
        Empleado.cliente_id == prog.cliente_id,
        Empleado.activo == True
    ).all()
    
    # Get current assignments for this programada
    asignaciones = db.query(AsignacionCapacitacion).filter(
        AsignacionCapacitacion.programada_id == programada_id
    ).all()
    asignado_ids = {a.empleado_id for a in asignaciones}
    
    asignados = []
    for a in asignaciones:
        emp = a.empleado
        asignados.append({
            "asignacion_id": a.id,
            "empleado_id": emp.id,
            "nombre": emp.nombre_completo,
            "dni": emp.dni,
            "area": emp.areas[0].nombre if emp.areas else "Sin área",
            "estado": a.estado,
            "origen": a.origen or "manual",
            "puede_quitar": a.estado == "pendiente"
        })
    
    elegibles_no_asignados = []
    for emp in all_employees:
        if emp.id in asignado_ids:
            continue
        if not _is_employee_eligible(emp, curso):
            continue
        elegibles_no_asignados.append({
            "empleado_id": emp.id,
            "nombre": emp.nombre_completo,
            "dni": emp.dni,
            "area": emp.areas[0].nombre if emp.areas else "Sin área"
        })
    
    return {
        "programada_id": programada_id,
        "estado": prog.estado,
        "asignados": asignados,
        "elegibles_no_asignados": elegibles_no_asignados
    }


class AsignarEmpleadoRequest(BaseModel):
    empleado_id: int

@router.post("/programadas/{programada_id}/asignar")
def asignar_empleado_a_programada(programada_id: int, payload: AsignarEmpleadoRequest, current_uid: str = Depends(get_current_user_uid), db: Session = Depends(get_db)):
    """Manually assign a single employee to a programada."""
    prog = db.query(CapacitacionProgramada).filter(CapacitacionProgramada.id == programada_id).first()
    if not prog:
        raise HTTPException(404, "Programada no encontrada")
    if prog.estado not in ("ACTIVA", "PROGRAMADA"):
        raise HTTPException(400, f"No se puede asignar en estado {prog.estado}")
    
    emp = db.query(Empleado).filter(Empleado.id == payload.empleado_id, Empleado.activo == True).first()
    if not emp:
        raise HTTPException(404, "Empleado no encontrado o inactivo")
    if emp.cliente_id != prog.cliente_id:
        raise HTTPException(400, "Empleado no pertenece al cliente de esta programada")
    
    # Idempotency
    existing = db.query(AsignacionCapacitacion).filter(
        AsignacionCapacitacion.empleado_id == payload.empleado_id,
        AsignacionCapacitacion.programada_id == programada_id
    ).first()
    if existing:
        return {"id": existing.id, "mensaje": "Ya estaba asignado", "estado": existing.estado}
    
    nueva = AsignacionCapacitacion(
        cliente_id=prog.cliente_id,
        empleado_id=payload.empleado_id,
        capacitacion_id=prog.capacitacion_id,
        programada_id=prog.id,
        estado="pendiente",
        origen="manual"
    )
    db.add(nueva)
    db.commit()
    db.refresh(nueva)
    return {"id": nueva.id, "estado": "pendiente", "mensaje": "Empleado asignado exitosamente"}


@router.delete("/programadas/{programada_id}/asignaciones/{asignacion_id}")
def quitar_empleado_de_programada(programada_id: int, asignacion_id: int, current_uid: str = Depends(get_current_user_uid), db: Session = Depends(get_db)):
    """Remove an employee assignment from a programada. Only allowed if status is 'pendiente'."""
    asig = db.query(AsignacionCapacitacion).filter(
        AsignacionCapacitacion.id == asignacion_id,
        AsignacionCapacitacion.programada_id == programada_id
    ).first()
    if not asig:
        raise HTTPException(404, "Asignación no encontrada")
    if asig.estado != "pendiente":
        raise HTTPException(400, f"No se puede quitar un empleado con estado '{asig.estado}'. Solo se permite quitar asignaciones pendientes.")
    
    db.delete(asig)
    db.commit()
    return {"id": asignacion_id, "eliminada": True, "mensaje": "Asignación eliminada"}




# ═══════════════════════════════════════════════════════════
# Plan Anual PDF - Executive Summary Download (v2 - Premium)
# ═══════════════════════════════════════════════════════════

@router.get("/{cliente_id}/{anio}/pdf")
def descargar_plan_anual_pdf(cliente_id: int, anio: int, current_uid: str = Depends(get_current_user_uid), db: Session = Depends(get_db)):
    """Generates a premium PDF summary of the annual training plan."""
    import os as _os
    from reportlab.lib.utils import ImageReader
    from reportlab.lib.enums import TA_LEFT, TA_RIGHT
    
    plan = db.query(PlanAnualCliente).filter(
        PlanAnualCliente.cliente_id == cliente_id,
        PlanAnualCliente.anio == anio
    ).first()
    
    cliente = db.query(Cliente).get(cliente_id)
    if not cliente:
        raise HTTPException(404, "Cliente no encontrado")
    
    programadas = db.query(CapacitacionProgramada).filter(
        CapacitacionProgramada.cliente_id == cliente_id,
        CapacitacionProgramada.anio == anio
    ).all()
    
    items = []
    if plan:
        for it in plan.items:
            items.append({
                "capacitacion_id": it.capacitacion_id,
                "nombre": it.capacitacion.nombre if it.capacitacion else "Desconocida",
                "mes": it.mes,
                "tipo": it.tipo,
                "activo": it.activo
            })
    
    # Color palette
    BLUE_DARK = '#0f3460'
    BLUE_MID = '#1a56a8'
    BLUE_LIGHT = '#e8f0fe'
    GRAY_DARK = '#334155'
    GRAY_MID = '#64748b'
    GRAY_LIGHT = '#f1f5f9'
    GREEN = '#166534'
    AMBER = '#92400e'
    RED = '#991b1b'
    
    output = io.BytesIO()
    doc = SimpleDocTemplate(output, pagesize=A4,
                            rightMargin=36, leftMargin=36,
                            topMargin=28, bottomMargin=28)
    
    elements = []
    styles = getSampleStyleSheet()
    page_w = A4[0] - 72  # usable width
    
    # --- Logo ---
    logo_path = _os.path.join(_os.path.dirname(__file__), '..', '..', 'static', 'logo_hdi.jpg')
    if not _os.path.exists(logo_path):
        logo_path = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..', '..', 'static', 'logo_hdi.jpg')
    
    logo = None
    if _os.path.exists(logo_path):
        try:
            logo = PlatypusImage(logo_path, width=90, height=72)
            logo.hAlign = 'LEFT'
        except:
            pass
    
    # ── HEADER: Dark blue banner with logo ──
    style_title = ParagraphStyle('PlanTitle', parent=styles['Heading1'],
        fontSize=22, alignment=TA_CENTER, spaceAfter=2,
        textColor=colors.white, fontName='Helvetica-Bold')
    style_subtitle = ParagraphStyle('PlanSubtitle', parent=styles['Normal'],
        fontSize=11, alignment=TA_CENTER, spaceAfter=0,
        textColor=colors.HexColor('#b0c4de'), fontName='Helvetica')
    
    title_para = Paragraph("PLAN ANUAL DE CAPACITACI\u00d3N", style_title)
    subtitle_para = Paragraph(f"{cliente.razon_social} \u2014 A\u00f1o {anio}", style_subtitle)
    
    if logo:
        header_table = Table(
            [[logo, [title_para, subtitle_para]]],
            colWidths=[100, page_w - 100]
        )
    else:
        header_table = Table(
            [[[title_para, subtitle_para]]],
            colWidths=[page_w]
        )
    
    header_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor(BLUE_DARK)),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('LEFTPADDING', (0, 0), (0, 0), 12),
        ('RIGHTPADDING', (-1, -1), (-1, -1), 12),
        ('ROUNDEDCORNERS', [6, 6, 0, 0]),
    ]))
    elements.append(header_table)
    
    # Thin accent line below header
    accent = Table([[""]], colWidths=[page_w])
    accent.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), colors.HexColor('#3b82f6')),
        ('TOPPADDING', (0, 0), (0, 0), 0),
        ('BOTTOMPADDING', (0, 0), (0, 0), 0),
        ('LINEABOVE', (0, 0), (0, 0), 3, colors.HexColor('#3b82f6')),
    ]))
    elements.append(accent)
    elements.append(Spacer(1, 16))
    
    # ── SECTION TITLE STYLE ──
    section_style = ParagraphStyle('SectionV2', parent=styles['Heading2'],
        fontSize=13, textColor=colors.HexColor(BLUE_DARK), spaceBefore=4, spaceAfter=8,
        fontName='Helvetica-Bold', borderPadding=(0, 0, 0, 4))
    
    # ── CALENDAR GRID ──
    MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
             "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
    
    mes_header_style = ParagraphStyle('MesHdr', parent=styles['Normal'],
        fontSize=9, fontName='Helvetica-Bold', textColor=colors.white, leading=12)
    mes_item_style = ParagraphStyle('MesItm', parent=styles['Normal'],
        fontSize=7.5, leading=10, textColor=colors.HexColor(GRAY_DARK))
    mes_empty_style = ParagraphStyle('MesEmp', parent=styles['Normal'],
        fontSize=7, textColor=colors.HexColor('#cbd5e1'))
    
    current_month = datetime.now().month
    current_year = datetime.now().year
    
    elements.append(Paragraph("PLANIFICACI\u00d3N MENSUAL", section_style))
    
    grid_data = []
    for row_idx in range(3):
        row = []
        for col_idx in range(4):
            mes_num = row_idx * 4 + col_idx + 1
            mes_items = [it for it in items if it["mes"] == mes_num and it["activo"]]
            is_current = (mes_num == current_month and anio == current_year)
            
            cell_parts = [Paragraph(MESES[mes_num - 1].upper(), mes_header_style)]
            cell_parts.append(Spacer(1, 4))
            
            if mes_items:
                for it in mes_items:
                    cell_parts.append(Paragraph(f"\u2022 {it['nombre']}", mes_item_style))
            else:
                cell_parts.append(Paragraph("\u2014", mes_empty_style))
            
            row.append(cell_parts)
        grid_data.append(row)
    
    col_w = page_w / 4
    grid_table = Table(grid_data, colWidths=[col_w]*4)
    
    grid_styles = [
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
    ]
    
    for r in range(3):
        for c in range(4):
            m = r * 4 + c + 1
            is_current = (m == current_month and anio == current_year)
            if is_current:
                bg = BLUE_MID
            else:
                bg = BLUE_DARK
            grid_styles.append(('BACKGROUND', (c, r), (c, r), colors.HexColor(bg)))
    
    grid_table.setStyle(TableStyle(grid_styles))
    elements.append(grid_table)
    elements.append(Spacer(1, 18))
    
    # ── EXECUTION SUMMARY ──
    if programadas:
        elements.append(Paragraph("RESUMEN DE EJECUCI\u00d3N", section_style))
        
        hdr_style = ParagraphStyle('TblHdr', parent=styles['Normal'],
            fontSize=8, fontName='Helvetica-Bold', textColor=colors.white, alignment=TA_CENTER)
        cell_style = ParagraphStyle('TblCell', parent=styles['Normal'],
            fontSize=8, leading=11, textColor=colors.HexColor(GRAY_DARK))
        cell_center = ParagraphStyle('TblCellC', parent=cell_style, alignment=TA_CENTER)
        
        header_row = [
            Paragraph("Capacitaci\u00f3n", hdr_style),
            Paragraph("Mes", hdr_style),
            Paragraph("Tipo", hdr_style),
            Paragraph("Estado", hdr_style),
            Paragraph("Asig.", hdr_style),
            Paragraph("Aprob.", hdr_style),
            Paragraph("Avance", hdr_style),
        ]
        
        table_data = [header_row]
        
        for p in sorted(programadas, key=lambda x: x.mes):
            curso = db.query(Capacitacion).get(p.capacitacion_id)
            asigs = db.query(AsignacionCapacitacion).filter(
                AsignacionCapacitacion.programada_id == p.id
            ).all()
            total_asig = len(asigs)
            aprobados = len([a for a in asigs if a.estado == 'aprobado'])
            pct = f"{int(aprobados/total_asig*100)}%" if total_asig > 0 else "\u2014"
            
            estado_map = {
                'ACTIVA': (GREEN, 'En curso'),
                'FINALIZADA': (BLUE_MID, 'Finalizada'),
                'PROGRAMADA': (AMBER, 'Programada'),
                'CANCELADA': (RED, 'Cancelada'),
            }
            ec, et = estado_map.get(p.estado, (GRAY_DARK, p.estado))
            
            row = [
                Paragraph(curso.nombre if curso else "N/A", cell_style),
                Paragraph(MESES[p.mes - 1][:3] + ".", cell_center),
                Paragraph(p.tipo.capitalize() if p.tipo else "", cell_center),
                Paragraph(f"<font color='{ec}'><b>{et}</b></font>", cell_center),
                Paragraph(str(total_asig), cell_center),
                Paragraph(str(aprobados), cell_center),
                Paragraph(f"<b>{pct}</b>", cell_center),
            ]
            table_data.append(row)
        
        exec_table = Table(table_data, colWidths=[page_w*0.30, page_w*0.09, page_w*0.10, page_w*0.15, page_w*0.10, page_w*0.10, page_w*0.10])
        exec_styles = [
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor(BLUE_DARK)),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor(GRAY_LIGHT)]),
            ('TOPPADDING', (0, 0), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
            ('LEFTPADDING', (0, 0), (-1, -1), 6),
            ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ]
        exec_table.setStyle(TableStyle(exec_styles))
        elements.append(exec_table)
    
    # ── FOOTER ──
    elements.append(Spacer(1, 24))
    
    # Footer separator
    sep2 = Table([[""]], colWidths=[page_w])
    sep2.setStyle(TableStyle([
        ('LINEABOVE', (0, 0), (0, 0), 0.5, colors.HexColor('#cbd5e1')),
    ]))
    elements.append(sep2)
    elements.append(Spacer(1, 6))
    
    footer_style = ParagraphStyle('FooterV2', parent=styles['Normal'],
        fontSize=7.5, textColor=colors.HexColor(GRAY_MID), alignment=TA_CENTER)
    generated_at = datetime.now().strftime('%d/%m/%Y %H:%M')
    elements.append(Paragraph(f"Documento generado autom\u00e1ticamente por HDI Consultores \u2014 {generated_at}", footer_style))
    elements.append(Paragraph("Seguridad \u00b7 Higiene \u00b7 Medio Ambiente", footer_style))
    
    doc.build(elements)
    
    pdf_data = output.getvalue()
    safe_name = cliente.razon_social.replace(' ', '_').replace('"', '')
    return Response(
        content=pdf_data,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="PlanAnual_{safe_name}_{anio}.pdf"'}
    )

