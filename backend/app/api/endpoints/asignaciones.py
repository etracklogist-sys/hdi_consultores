from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.db.database import get_db
from app.models.domain import AsignacionCapacitacion, Cliente, Empleado, Capacitacion, Area, empleado_areas, CapacitacionProgramada
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()

class AsignacionMasivaRequest(BaseModel):
    cliente_id: int
    capacitacion_ids: List[int]
    empleado_ids: Optional[List[int]] = None  # None = all eligible employees (masiva)

class AsignacionResponse(BaseModel):
    id: int
    cliente_id: int
    empleado_id: int
    capacitacion_id: int
    estado: str
    empleado_nombre: str | None = None
    capacitacion_nombre: str | None = None

    class Config:
        from_attributes = True

# ─── Eligibility helpers ───

def _is_training_compatible_with_client(cap, cliente):
    """Check rubro + area compatibility between training and client."""
    # Rule A: Rubro check
    if cap.rubro_id and cap.rubro_id != cliente.rubro_id:
        return False, f"Rubro incompatible: '{cap.nombre}' requiere rubro '{cap.rubro.nombre if cap.rubro else '?'}'"
    
    # Rule: Client area check — training.area_id must be in cliente.areas
    if cap.area_id:
        client_area_ids = {a.id for a in cliente.areas}
        if cap.area_id not in client_area_ids:
            return False, f"Área incompatible: '{cap.nombre}' requiere área '{cap.area.nombre if cap.area else '?'}' que el cliente no tiene"
    
    return True, None

def _is_employee_eligible(emp, cap):
    """Check if employee is eligible for a training based on area (M2M)."""
    if not cap.area_id:
        return True  # No area restriction — all employees eligible
    # training.area_id must be IN employee.areas (M2M)
    return any(a.id == cap.area_id for a in emp.areas)

# ─── POST /masivas ───

@router.post("/masivas")
def crear_asignaciones_masivas(req: AsignacionMasivaRequest, db: Session = Depends(get_db)):
    cliente = db.query(Cliente).filter(Cliente.id == req.cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    
    # Validate capacitaciones exist
    capacitaciones = db.query(Capacitacion).filter(Capacitacion.id.in_(req.capacitacion_ids)).all()
    if not capacitaciones:
        raise HTTPException(status_code=400, detail="No se encontraron capacitaciones válidas.")
    
    # Validate ALL trainings are compatible with this client (rubro + area)
    errores = []
    for cap in capacitaciones:
        compatible, msg = _is_training_compatible_with_client(cap, cliente)
        if not compatible:
            errores.append(msg)
    
    if errores:
        raise HTTPException(status_code=400, detail="Incompatibilidad: " + " | ".join(errores))
    
    # Get employees
    if req.empleado_ids:
        empleados = db.query(Empleado).filter(
            Empleado.id.in_(req.empleado_ids),
            Empleado.cliente_id == req.cliente_id,
            Empleado.activo == True
        ).all()
    else:
        empleados = db.query(Empleado).filter(
            Empleado.cliente_id == req.cliente_id,
            Empleado.activo == True
        ).all()
    
    if not empleados:
        raise HTTPException(status_code=400, detail="No se encontraron empleados activos para asignar.")
    
    created = 0
    skipped = 0
    ineligible = 0
    
    import json
    for cap in capacitaciones:
        # Wrap the manual mass assignment into a new EVENTUAL programada automatically activated
        prog = CapacitacionProgramada(
            cliente_id=req.cliente_id,
            capacitacion_id=cap.id,
            mes=datetime.now(timezone.utc).month,
            anio=datetime.now(timezone.utc).year,
            tipo="EVENTUAL",
            modalidad_final=cap.modalidad,
            requiere_evaluacion_final=cap.requiere_evaluacion,
            estado="ACTIVA",
            fecha_activacion=datetime.now(timezone.utc),
            alcance_asignacion="SUBCONJUNTO" if req.empleado_ids else "TODOS",
            empleados_incluidos=json.dumps(req.empleado_ids) if req.empleado_ids else None
        )
        db.add(prog)
        db.commit()
        db.refresh(prog)

        for emp in empleados:
            # Rule B: Employee area eligibility
            if not _is_employee_eligible(emp, cap):
                ineligible += 1
                continue
            
            # Duplicate prevention: Only skip if employee already has an ACTIVA assignment for this cap
            existing_activa = db.query(AsignacionCapacitacion).join(CapacitacionProgramada).filter(
                AsignacionCapacitacion.empleado_id == emp.id,
                AsignacionCapacitacion.capacitacion_id == cap.id,
                CapacitacionProgramada.estado == "ACTIVA"
            ).first()
            
            if existing_activa:
                skipped += 1
                continue
            
            nueva = AsignacionCapacitacion(
                cliente_id=req.cliente_id,
                empleado_id=emp.id,
                capacitacion_id=cap.id,
                programada_id=prog.id,
                estado="pendiente",
                origen="masiva" if not req.empleado_ids else "manual"
            )
            db.add(nueva)
            created += 1
    
    db.commit()
    
    msg_parts = [f"{created} nuevas asignaciones"]
    if skipped:
        msg_parts.append(f"{skipped} omitidas (ya tienen una ACTIVA)")
    if ineligible:
        msg_parts.append(f"{ineligible} omitidas (área no compatible)")
    
    return {
        "message": f"Asignación completada: {', '.join(msg_parts)}.",
        "created": created,
        "skipped": skipped,
        "ineligible": ineligible,
        "total_empleados": len(empleados),
        "total_capacitaciones": len(capacitaciones)
    }

# ─── GET /cliente/{id} ───

@router.get("/cliente/{cliente_id}")
def get_asignaciones_por_cliente(cliente_id: int, db: Session = Depends(get_db)):
    # outerjoin to include legacy assignments with programada_id=NULL
    asignaciones = db.query(AsignacionCapacitacion).outerjoin(CapacitacionProgramada).filter(
        AsignacionCapacitacion.cliente_id == cliente_id
    ).all()
    
    result = []
    for a in asignaciones:
        result.append({
            "id": a.id,
            "empleado_id": a.empleado_id,
            "empleado_nombre": a.empleado.nombre_completo if a.empleado else "N/A",
            "capacitacion_id": a.capacitacion_id,
            "capacitacion_nombre": a.capacitacion.nombre if a.capacitacion else "N/A",
            "estado": a.estado,
            "origen": a.origen,
            "fecha_asignacion": a.fecha_asignacion.isoformat() if a.fecha_asignacion else None
        })
    
    return result

# ─── GET /elegibles ───

@router.get("/elegibles")
def get_empleados_elegibles(cliente_id: int, capacitacion_ids: str, db: Session = Depends(get_db)):
    """Get employees eligible for ALL selected trainings (M2M area intersection)."""
    cap_ids = [int(x) for x in capacitacion_ids.split(",") if x.strip()]
    capacitaciones = db.query(Capacitacion).filter(Capacitacion.id.in_(cap_ids)).all()
    
    empleados = db.query(Empleado).filter(
        Empleado.cliente_id == cliente_id,
        Empleado.activo == True
    ).all()
    
    # Employee must be eligible for ALL selected trainings
    elegibles = []
    for emp in empleados:
        eligible_for_all = all(_is_employee_eligible(emp, cap) for cap in capacitaciones)
        if eligible_for_all:
            # Show all employee areas (M2M)
            emp_areas = [a.nombre for a in emp.areas] if emp.areas else []
            elegibles.append({
                "id": emp.id,
                "nombre_completo": emp.nombre_completo,
                "dni": emp.dni,
                "areas": emp_areas,
                "area_nombre": ", ".join(emp_areas) if emp_areas else None,
                "eligible": True
            })
    
    return elegibles

# ─── GET /preview ───

@router.get("/preview")
def preview_asignacion(cliente_id: int, capacitacion_ids: str, db: Session = Depends(get_db)):
    """Preview how many assignments would be created."""
    cap_ids = [int(x) for x in capacitacion_ids.split(",") if x.strip()]
    capacitaciones = db.query(Capacitacion).filter(Capacitacion.id.in_(cap_ids)).all()
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    
    empleados = db.query(Empleado).filter(
        Empleado.cliente_id == cliente_id,
        Empleado.activo == True
    ).all()
    
    new_count = 0
    existing_count = 0
    ineligible_count = 0
    client_incompatible = 0
    
    for cap in capacitaciones:
        # Check client compatibility first
        if cliente:
            compatible, _ = _is_training_compatible_with_client(cap, cliente)
            if not compatible:
                client_incompatible += len(empleados)
                continue
        
        for emp in empleados:
            if not _is_employee_eligible(emp, cap):
                ineligible_count += 1
                continue
            existing_activa = db.query(AsignacionCapacitacion).join(CapacitacionProgramada).filter(
                AsignacionCapacitacion.empleado_id == emp.id,
                AsignacionCapacitacion.capacitacion_id == cap.id,
                CapacitacionProgramada.estado == "ACTIVA"
            ).first()
            if existing_activa:
                existing_count += 1
            else:
                new_count += 1
    
    return {
        "total_empleados": len(empleados),
        "total_capacitaciones": len(capacitaciones),
        "total_asignaciones_nuevas": new_count,
        "duplicados_omitidos": existing_count,
        "ineligibles_area": ineligible_count,
        "incompatibles_cliente": client_incompatible
    }

# ─── Attendance Control (Presential Trainings) ───

class AttendanceUpdate(BaseModel):
    asignacion_id: int
    asistio: bool

class BulkAttendanceRequest(BaseModel):
    programada_id: int
    attendance: List[AttendanceUpdate]

@router.post("/attendance")
def update_attendance(req: BulkAttendanceRequest, db: Session = Depends(get_db)):
    """Update attendance for assignments within a Programada.
    For presential trainings without evaluation, attendance triggers completion.
    """
    programada = db.query(CapacitacionProgramada).filter(CapacitacionProgramada.id == req.programada_id).first()
    if not programada:
        raise HTTPException(status_code=404, detail="Programada no encontrada")
    
    updated = 0
    for item in req.attendance:
        asig = db.query(AsignacionCapacitacion).filter(
            AsignacionCapacitacion.id == item.asignacion_id,
            AsignacionCapacitacion.programada_id == req.programada_id
        ).first()
        
        if not asig:
            continue
        
        asig.asistio = item.asistio
        
        # Auto-complete for presential without evaluation IF attended
        requiere_eval = programada.requiere_evaluacion_final
        if item.asistio and not requiere_eval and not asig.completed_at:
            asig.completed_at = datetime.now(timezone.utc)
            asig.completion_method = "ATTENDANCE"
            asig.estado = "aprobado"
        elif not item.asistio and asig.completion_method == "ATTENDANCE":
            # Undo if attendance is unchecked
            asig.completed_at = None
            asig.completion_method = None
            asig.estado = "pendiente"
        
        updated += 1
    
    db.commit()
    return {"message": f"Asistencia actualizada para {updated} asignaciones"}

@router.get("/programada/{programada_id}/attendance")
def get_attendance(programada_id: int, db: Session = Depends(get_db)):
    """Get attendance status for all assignments in a Programada."""
    asignaciones = db.query(AsignacionCapacitacion).filter(
        AsignacionCapacitacion.programada_id == programada_id
    ).all()
    
    return [{
        "asignacion_id": a.id,
        "empleado_id": a.empleado_id,
        "empleado_nombre": a.empleado.nombre_completo if a.empleado else "N/A",
        "asistio": a.asistio,
        "completed_at": a.completed_at.isoformat() if a.completed_at else None,
        "completion_method": a.completion_method,
    } for a in asignaciones]



