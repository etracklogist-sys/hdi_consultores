from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from app.db.database import get_db
from app.models.domain import (
    Cliente, Capacitacion, Rubro, AsignacionCapacitacion, Area, Empleado,
    CapacitacionProgramada, Certificado
)
from pydantic import BaseModel
from typing import List, Optional

router = APIRouter()

class ClienteCreate(BaseModel):
    razon_social: str
    cuit: str
    rubro_id: int
    area_ids: List[int] = []

class ClienteUpdate(BaseModel):
    razon_social: str | None = None
    cuit: str | None = None
    rubro_id: int | None = None
    area_ids: List[int] | None = None
    activo: bool | None = None

class ClienteResponse(BaseModel):
    id: int
    razon_social: str
    cuit: str
    rubro_id: int | None = None
    rubro_nombre: str | None = None
    activo: bool
    
    class Config:
        from_attributes = True

# ─── LIST / GET ───

@router.get("/")
def get_clientes(db: Session = Depends(get_db)):
    clientes = db.query(Cliente).all()
    result = []
    for c in clientes:
        has_history = (
            db.query(Empleado).filter(Empleado.cliente_id == c.id).first() is not None or
            db.query(CapacitacionProgramada).filter(CapacitacionProgramada.cliente_id == c.id).first() is not None or
            db.query(AsignacionCapacitacion).filter(AsignacionCapacitacion.cliente_id == c.id).first() is not None or
            db.query(Certificado).filter(Certificado.cliente_id == c.id).first() is not None
        )
        can_delete = not has_history
        result.append({
            "id": c.id,
            "razon_social": c.razon_social,
            "cuit": c.cuit,
            "rubro_id": c.rubro_id,
            "rubro_nombre": c.rubro.nombre if c.rubro else None,
            "activo": c.activo,
            "can_delete": can_delete,
            "can_archive": not can_delete and c.activo
        })
    return result

@router.get("/{cliente_id}")
def get_cliente_detail(cliente_id: int, db: Session = Depends(get_db)):
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    
    rubro_nombre = cliente.rubro.nombre if cliente.rubro else None
    areas_data = [{"id": a.id, "nombre": a.nombre} for a in cliente.areas]
    empleados_activos = len([e for e in cliente.empleados if e.activo])
    
    # Get available trainings: those compatible with client's rubro
    capacitaciones_disponibles = []
    query = db.query(Capacitacion)
    if cliente.rubro_id:
        query = query.filter(
            (Capacitacion.rubro_id == cliente.rubro_id) | (Capacitacion.rubro_id == None)
        )
    else:
        query = query.filter(Capacitacion.rubro_id == None)
    
    for cap in query.all():
        capacitaciones_disponibles.append({
            "id": cap.id,
            "nombre": cap.nombre,
            "obligatoria": True,
            "rubro_nombre": cap.rubro.nombre if cap.rubro else None,
            "area_aplicable": cap.area.nombre if cap.area else "Todas",
            "modalidad": cap.modalidad
        })
    
    has_history = (
        len(cliente.empleados) > 0 or
        db.query(CapacitacionProgramada).filter(CapacitacionProgramada.cliente_id == cliente.id).first() is not None or
        db.query(AsignacionCapacitacion).filter(AsignacionCapacitacion.cliente_id == cliente.id).first() is not None or
        db.query(Certificado).filter(Certificado.cliente_id == cliente.id).first() is not None
    )
    can_delete = not has_history
    
    return {
        "id": cliente.id,
        "razon_social": cliente.razon_social,
        "cuit": cliente.cuit,
        "rubro_id": cliente.rubro_id,
        "rubro_nombre": rubro_nombre,
        "activo": cliente.activo,
        "areas": areas_data,
        "total_empleados": len(cliente.empleados),
        "empleados_activos": empleados_activos,
        "capacitaciones_disponibles": capacitaciones_disponibles,
        "can_delete": can_delete,
        "can_archive": not can_delete and cliente.activo
    }

# ─── CREATE ───

@router.post("/")
def create_cliente(cliente: ClienteCreate, db: Session = Depends(get_db)):
    db_cliente = db.query(Cliente).filter(Cliente.cuit == cliente.cuit).first()
    if db_cliente:
        raise HTTPException(status_code=400, detail="El cliente ya existe")
    
    rubro = db.query(Rubro).filter(Rubro.id == cliente.rubro_id).first()
    if not rubro:
        raise HTTPException(status_code=404, detail="Rubro no encontrado")
    
    nuevo_cliente = Cliente(
        razon_social=cliente.razon_social,
        cuit=cliente.cuit,
        rubro_id=cliente.rubro_id
    )
    
    if cliente.area_ids:
        areas = db.query(Area).filter(Area.id.in_(cliente.area_ids)).all()
        nuevo_cliente.areas = areas
    
    db.add(nuevo_cliente)
    db.commit()
    db.refresh(nuevo_cliente)
    
    return {
        "id": nuevo_cliente.id,
        "razon_social": nuevo_cliente.razon_social,
        "cuit": nuevo_cliente.cuit,
        "rubro_id": nuevo_cliente.rubro_id,
        "rubro_nombre": nuevo_cliente.rubro.nombre if nuevo_cliente.rubro else None,
        "activo": nuevo_cliente.activo
    }

# ─── UPDATE ───

@router.put("/{cliente_id}")
def update_cliente(cliente_id: int, update: ClienteUpdate, db: Session = Depends(get_db)):
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    
    if update.razon_social is not None:
        cliente.razon_social = update.razon_social
    if update.cuit is not None:
        cliente.cuit = update.cuit
    if update.rubro_id is not None:
        rubro = db.query(Rubro).filter(Rubro.id == update.rubro_id).first()
        if not rubro:
            raise HTTPException(status_code=404, detail="Rubro no encontrado")
        cliente.rubro_id = update.rubro_id
    if update.area_ids is not None:
        areas = db.query(Area).filter(Area.id.in_(update.area_ids)).all()
        cliente.areas = areas
    if update.activo is not None:
        cliente.activo = update.activo
    
    db.commit()
    db.refresh(cliente)
    
    return {
        "id": cliente.id,
        "razon_social": cliente.razon_social,
        "cuit": cliente.cuit,
        "rubro_id": cliente.rubro_id,
        "rubro_nombre": cliente.rubro.nombre if cliente.rubro else None,
        "activo": cliente.activo
    }

# ─── DELETION & ARCHIVING ───

@router.delete("/{cliente_id}")
def delete_cliente(cliente_id: int, db: Session = Depends(get_db)):
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
        
    has_history = (
        db.query(Empleado).filter(Empleado.cliente_id == cliente.id).first() is not None or
        db.query(CapacitacionProgramada).filter(CapacitacionProgramada.cliente_id == cliente.id).first() is not None or
        db.query(AsignacionCapacitacion).filter(AsignacionCapacitacion.cliente_id == cliente.id).first() is not None or
        db.query(Certificado).filter(Certificado.cliente_id == cliente.id).first() is not None
    )
    
    if has_history:
        raise HTTPException(status_code=400, detail="This entity cannot be deleted because it has operational history.")
        
    db.delete(cliente)
    db.commit()
    return {"message": "Cliente eliminado permanentemente"}

@router.patch("/{cliente_id}/archivar")
def archivar_cliente(cliente_id: int, db: Session = Depends(get_db)):
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
        
    cliente.activo = False
    db.commit()
    return {"message": "Cliente archivado correctamente"}

# ─── CLIENT AREAS (convenience) ───

@router.get("/{cliente_id}/areas")
def get_cliente_areas(cliente_id: int, db: Session = Depends(get_db)):
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    return [{"id": a.id, "nombre": a.nombre} for a in cliente.areas]

# ─── CLIENT EMPLOYEES ───

@router.get("/{cliente_id}/empleados")
def get_cliente_empleados(cliente_id: int, db: Session = Depends(get_db)):
    empleados = db.query(Empleado).filter(Empleado.cliente_id == cliente_id).all()
    return [
        {
            "id": e.id,
            "nombre_completo": e.nombre_completo,
            "dni": e.dni,
            "email": e.email,
            "activo": e.activo,
            "area_nombre": e.areas[0].nombre if e.areas else None
        }
        for e in empleados
    ]

# ─── CLIENT ASIGNACIONES ───

@router.get("/{cliente_id}/asignaciones")
def get_cliente_asignaciones(cliente_id: int, db: Session = Depends(get_db)):
    asignaciones = db.query(AsignacionCapacitacion).filter(
        AsignacionCapacitacion.cliente_id == cliente_id
    ).all()
    
    cap_map = {}
    for a in asignaciones:
        cap_id = a.capacitacion_id
        if cap_id not in cap_map:
            cap_map[cap_id] = {
                "capacitacion_id": cap_id,
                "titulo": a.capacitacion.nombre if a.capacitacion else "N/A",
                "origen": a.origen,
                "empleados_alcanzados": 0,
                "aprobados": 0,
                "pendientes": 0,
                "estado": "Pendiente"
            }
        cap_map[cap_id]["empleados_alcanzados"] += 1
        if a.estado == "aprobado":
            cap_map[cap_id]["aprobados"] += 1
        else:
            cap_map[cap_id]["pendientes"] += 1
    
    for cap_id in cap_map:
        entry = cap_map[cap_id]
        if entry["pendientes"] == 0 and entry["aprobados"] > 0:
            entry["estado"] = "Completada"
    
    return list(cap_map.values())

# ─── PER-CAPACITACION ASSIGNMENT DETAIL ───

@router.get("/{cliente_id}/programadas/{programada_id}/asignaciones")
def get_cliente_programada_asignaciones(cliente_id: int, programada_id: int, db: Session = Depends(get_db)):
    """
    Returns operational detail for a specific programada within a client:
    assigned employees, their status, scores, and summary KPIs.
    Uses AsignacionCapacitacion grouped by programada_id as the source of truth.
    """
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
    
    prog = db.query(CapacitacionProgramada).filter(CapacitacionProgramada.id == programada_id, CapacitacionProgramada.cliente_id == cliente_id).first()
    if not prog:
        raise HTTPException(status_code=404, detail="Programada no encontrada")
    
    cap = prog.capacitacion
    
    asignaciones = db.query(AsignacionCapacitacion).filter(
        AsignacionCapacitacion.cliente_id == cliente_id,
        AsignacionCapacitacion.programada_id == programada_id
    ).all()
    
    empleados_list = []
    total = len(asignaciones)
    aprobados = 0
    pendientes = 0
    en_curso = 0
    
    for a in asignaciones:
        emp = a.empleado
        if a.estado == "aprobado":
            aprobados += 1
        elif a.estado == "en_curso":
            en_curso += 1
        else:
            pendientes += 1
        
        empleados_list.append({
            "empleado_id": emp.id,
            "nombre": emp.nombre_completo,
            "dni": emp.dni,
            "area": emp.areas[0].nombre if emp.areas else "Sin área",
            "estado": a.estado,
            "nota": None,  # Can be extended with Intento scores later
            "origen": a.origen or "manual"
        })
    
    return {
        "programada": {
            "id": prog.id,
            "nombre": cap.nombre if cap else "Desconocida",
            "mes": prog.mes,
            "anio": prog.anio,
            "estado": prog.estado,
            "tipo": prog.tipo,
            "tipo_modalidad": prog.modalidad_final,
            "area": cap.area.nombre if cap and cap.area else "General"
        },
        "resumen": {
            "total": total,
            "aprobados": aprobados,
            "pendientes": pendientes,
            "en_curso": en_curso
        },
        "empleados": empleados_list
    }

# ─── OPERATIONAL DASHBOARD ───

@router.get("/{cliente_id}/dashboard")
def get_cliente_dashboard(
    cliente_id: int,
    mes: int = Query(default=None),
    anio: int = Query(default=None),
    db: Session = Depends(get_db)
):
    """
    Operational dashboard for a client.
    Returns real execution metrics built from CapacitacionProgramada + Asignaciones.
    NOT from catalog definitions.
    """
    cliente = db.query(Cliente).filter(Cliente.id == cliente_id).first()
    if not cliente:
        raise HTTPException(404, "Cliente no encontrado")
    
    now = datetime.now(timezone.utc)
    target_mes = mes or now.month
    target_anio = anio or now.year
    
    # ── All programadas for this client and year ──
    all_programadas = db.query(CapacitacionProgramada).filter(
        CapacitacionProgramada.cliente_id == cliente_id,
        CapacitacionProgramada.anio == target_anio
    ).all()
    
    # Normalize legacy CERRADA based on lifecycle timing
    def _effective_estado(p):
        if p.estado != "CERRADA":
            return p.estado
        # Current or future month → treat as PROGRAMADA (pending activation)
        if (p.anio > target_anio) or (p.anio == target_anio and p.mes >= target_mes):
            return "PROGRAMADA"
        return "FINALIZADA"
    
    # ── Current month programadas (the main operational view) ──
    month_programadas = [p for p in all_programadas if p.mes == target_mes]
    active_programadas = [p for p in all_programadas if _effective_estado(p) == "ACTIVA"]
    programada_programadas = [p for p in all_programadas if _effective_estado(p) == "PROGRAMADA"]
    # Operational = both ACTIVA and PROGRAMADA (PROGRAMADA must not disappear from the dashboard)
    operational_programadas = [p for p in all_programadas if _effective_estado(p) in ("ACTIVA", "PROGRAMADA")]
    
    # ── Build per-programada operational metrics ──
    programadas_detail = []
    total_asignados_global = 0
    total_aprobados_global = 0
    total_desaprobados_global = 0
    total_pendientes_global = 0
    total_en_curso_global = 0
    
    for p in operational_programadas:
        curso = p.capacitacion
        asignaciones = p.asignaciones
        
        aprobados = sum(1 for a in asignaciones if a.estado == "aprobado")
        desaprobados = sum(1 for a in asignaciones if a.estado == "desaprobado")
        en_curso = sum(1 for a in asignaciones if a.estado == "en_curso")
        pendientes = sum(1 for a in asignaciones if a.estado == "pendiente")
        total = len(asignaciones)
        completados = aprobados + desaprobados
        
        total_asignados_global += total
        total_aprobados_global += aprobados
        total_desaprobados_global += desaprobados
        total_pendientes_global += pendientes
        total_en_curso_global += en_curso
        
        programadas_detail.append({
            "id": p.id,
            "nombre": curso.nombre if curso else "Desconocida",
            "mes": p.mes,
            "estado": _effective_estado(p),
            "tipo": p.tipo,
            "modalidad": p.modalidad_final,
            "fecha_activacion": p.fecha_activacion.isoformat() if p.fecha_activacion else None,
            "total_asignados": total,
            "en_curso": en_curso,
            "aprobados": aprobados,
            "desaprobados": desaprobados,
            "pendientes": pendientes,
            "porcentaje_avance": round((completados / total * 100) if total > 0 else 0, 1),
            "can_delete": p.estado == "PROGRAMADA" and total == 0,
            "can_cancel": p.estado in ("PROGRAMADA", "ACTIVA")
        })
    
    # ── KPIs ──
    empleados_activos = db.query(Empleado).filter(
        Empleado.cliente_id == cliente_id,
        Empleado.activo == True
    ).count()
    
    empleados_con_cap = db.query(AsignacionCapacitacion.empleado_id).filter(
        AsignacionCapacitacion.cliente_id == cliente_id,
        AsignacionCapacitacion.programada_id.in_([p.id for p in active_programadas]) if active_programadas else False
    ).distinct().count() if active_programadas else 0
    
    pct_aprobados = round((total_aprobados_global / total_asignados_global * 100) if total_asignados_global > 0 else 0, 1)
    pct_desaprobados = round((total_desaprobados_global / total_asignados_global * 100) if total_asignados_global > 0 else 0, 1)
    
    # ── Per-employee status for active programadas ──
    empleados_status = []
    if active_programadas:
        prog_ids = [p.id for p in active_programadas]
        asignaciones_activas = db.query(AsignacionCapacitacion).filter(
            AsignacionCapacitacion.cliente_id == cliente_id,
            AsignacionCapacitacion.programada_id.in_(prog_ids)
        ).all()
        
        for a in asignaciones_activas:
            emp = a.empleado
            cap = a.capacitacion
            prog = a.programada
            
            cap_str = f"{cap.nombre} ({prog.mes}/{prog.anio} - {prog.tipo})" if cap and prog else (cap.nombre if cap else "N/A")

            empleados_status.append({
                "empleado_id": emp.id,
                "nombre": emp.nombre_completo,
                "dni": emp.dni,
                "capacitacion": cap_str,
                "estado": a.estado,
                "programada_id": a.programada_id
            })
    
    # ── Year summary counts (normalized — CERRADA counts as FINALIZADA) ──
    year_summary = {
        "total": len(all_programadas),
        "activas": sum(1 for p in all_programadas if _effective_estado(p) == "ACTIVA"),
        "programadas": sum(1 for p in all_programadas if _effective_estado(p) == "PROGRAMADA"),
        "finalizadas": sum(1 for p in all_programadas if _effective_estado(p) == "FINALIZADA"),
        "canceladas": sum(1 for p in all_programadas if _effective_estado(p) == "CANCELADA")
    }
    
    return {
        "cliente_id": cliente_id,
        "razon_social": cliente.razon_social,
        "mes": target_mes,
        "anio": target_anio,
        "kpis": {
            "capacitaciones_activas": len(active_programadas),
            "capacitaciones_programadas": len(programada_programadas),
            "empleados_activos": empleados_activos,
            "empleados_con_capacitacion": empleados_con_cap,
            "total_asignaciones": total_asignados_global,
            "aprobados": total_aprobados_global,
            "desaprobados": total_desaprobados_global,
            "en_curso": total_en_curso_global,
            "pendientes": total_pendientes_global,
            "pct_aprobados": pct_aprobados,
            "pct_desaprobados": pct_desaprobados
        },
        "programadas": programadas_detail,
        "empleados_status": empleados_status,
        "year_summary": year_summary
    }
