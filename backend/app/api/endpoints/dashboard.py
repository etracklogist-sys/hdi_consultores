import logging
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_, not_, exists
from app.db.database import get_db
from app.models.domain import (
    Cliente, Empleado, Certificado, AsignacionCapacitacion,
    Capacitacion, Intento, CapacitacionProgramada, empleado_areas
)
from datetime import datetime, timedelta, timezone
from typing import Optional

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/resumen")
def get_dashboard_summary(cliente_id: Optional[int] = Query(None), db: Session = Depends(get_db)):
    """Operational KPIs for the dashboard."""
    try:
        # Base filters
        asig_filter = []
        prog_filter = []
        cert_filter = []

        if cliente_id:
            asig_filter.append(AsignacionCapacitacion.cliente_id == cliente_id)
            prog_filter.append(CapacitacionProgramada.cliente_id == cliente_id)
            cert_filter.append(Certificado.cliente_id == cliente_id)

        # 1. Instancias Activas (ACTIVA programadas)
        instancias_activas = db.query(func.count(CapacitacionProgramada.id)).filter(
            CapacitacionProgramada.estado == "ACTIVA",
            *prog_filter
        ).scalar() or 0

        # 2. Pendientes de Activación (PROGRAMADA)
        pendientes_activacion = db.query(func.count(CapacitacionProgramada.id)).filter(
            CapacitacionProgramada.estado == "PROGRAMADA",
            *prog_filter
        ).scalar() or 0

        # 3. Asignaciones pendientes
        asignaciones_pendientes = db.query(func.count(AsignacionCapacitacion.id)).filter(
            AsignacionCapacitacion.estado == "pendiente",
            *asig_filter
        ).scalar() or 0

        # 4. Certificados por vencer (próximos 30 días)
        fecha_limite = datetime.now(timezone.utc) + timedelta(days=30)
        certificados_por_vencer = db.query(func.count(Certificado.id)).filter(
            Certificado.fecha_vencimiento <= fecha_limite,
            *cert_filter
        ).scalar() or 0

        # 5. Evaluaciones desaprobadas
        eval_query = db.query(func.count(Intento.id)).filter(
            Intento.estado == "FINALIZADO",
            Intento.aprobado == False
        )
        if cliente_id:
            eval_query = eval_query.join(
                AsignacionCapacitacion,
                Intento.asignacion_id == AsignacionCapacitacion.id
            ).filter(AsignacionCapacitacion.cliente_id == cliente_id)
        evaluaciones_fallidas = eval_query.scalar() or 0

        # 6. % Cumplimiento (aprobados / total asignaciones)
        total_asignaciones = db.query(func.count(AsignacionCapacitacion.id)).filter(*asig_filter).scalar() or 0
        total_aprobadas = db.query(func.count(AsignacionCapacitacion.id)).filter(
            AsignacionCapacitacion.estado == "aprobado",
            *asig_filter
        ).scalar() or 0
        pct_cumplimiento = round((total_aprobadas / total_asignaciones * 100) if total_asignaciones > 0 else 0, 1)

        # Totals for context
        total_clientes = db.query(func.count(Cliente.id)).filter(Cliente.activo == True).scalar() or 0
        emp_filter = [Empleado.activo == True]
        if cliente_id:
            emp_filter.append(Empleado.cliente_id == cliente_id)
        total_empleados = db.query(func.count(Empleado.id)).filter(*emp_filter).scalar() or 0

        return {
            "kpis": {
                "instancias_activas": instancias_activas,
                "pendientes_activacion": pendientes_activacion,
                "asignaciones_pendientes": asignaciones_pendientes,
                "certificados_por_vencer": certificados_por_vencer,
                "evaluaciones_fallidas": evaluaciones_fallidas,
                "pct_cumplimiento": pct_cumplimiento,
                "total_clientes": total_clientes,
                "total_empleados": total_empleados
            }
        }
    except Exception as e:
        logger.error(f"Error cargando resumen dashboard: {str(e)}")
        return {
            "kpis": {
                "instancias_activas": 0,
                "pendientes_activacion": 0,
                "asignaciones_pendientes": 0,
                "certificados_por_vencer": 0,
                "evaluaciones_fallidas": 0,
                "pct_cumplimiento": 0,
                "total_clientes": 0,
                "total_empleados": 0
            }
        }

@router.get("/acciones")
def get_acciones_requeridas(limite: int = Query(5, ge=1, le=20), db: Session = Depends(get_db)):
    """Recent action items: failed evaluations, pending assignments, expiring certs."""
    acciones = []

    # Failed evaluations — need retake
    intentos_fallidos = db.query(Intento).filter(
        Intento.estado == "FINALIZADO",
        Intento.aprobado == False
    ).order_by(Intento.fecha_fin.desc()).limit(limite).all()

    for i in intentos_fallidos:
        asig = i.asignacion
        if asig and asig.empleado:
            meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
            prog = asig.programada
            prog_context = "N/A"
            if prog and asig.capacitacion:
                mes_str = meses[prog.mes - 1] if prog.mes else ""
                prog_context = f"{mes_str} {prog.anio} · {prog.tipo} · {asig.capacitacion.nombre}"
            elif asig.capacitacion:
                prog_context = asig.capacitacion.nombre
                
            acciones.append({
                "tipo": "evaluacion_fallida",
                "empleado_nombre": asig.empleado.nombre_completo,
                "cliente_nombre": asig.cliente.razon_social if asig.cliente else "N/A",
                "capacitacion": prog_context,
                "nota": round(i.nota_final, 1) if i.nota_final else 0,
                "accion": "Reintentar",
                "fecha": i.fecha_fin.isoformat() if i.fecha_fin else None
            })

    # Expiring certs — need renewal
    fecha_limite = datetime.now(timezone.utc) + timedelta(days=30)
    certs_por_vencer = db.query(Certificado).filter(
        Certificado.fecha_vencimiento <= fecha_limite,
        Certificado.estado == "VIGENTE"
    ).order_by(Certificado.fecha_vencimiento.asc()).limit(limite).all()

    for c in certs_por_vencer:
        days_left = (c.fecha_vencimiento - datetime.now(timezone.utc)).days if c.fecha_vencimiento.tzinfo else (c.fecha_vencimiento - datetime.now()).days
        meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
        prog_context = c.capacitacion.nombre if c.capacitacion else "N/A"
        # Optional: check if Certificado links to an asignacion that links to a programada
        if c.asignacion and c.asignacion.programada and c.capacitacion:
            prog = c.asignacion.programada
            mes_str = meses[prog.mes - 1] if prog.mes else ""
            prog_context = f"{mes_str} {prog.anio} · {prog.tipo} · {c.capacitacion.nombre}"
            
        acciones.append({
            "tipo": "certificado_venciendo",
            "empleado_nombre": c.empleado.nombre_completo if c.empleado else "N/A",
            "cliente_nombre": c.cliente.razon_social if c.cliente else "N/A",
            "capacitacion": prog_context,
            "dias_restantes": days_left,
            "accion": "Reasignar",
            "fecha": c.fecha_vencimiento.isoformat()
        })

    return acciones[:limite]


@router.get("/estado-clientes")
def get_estado_por_cliente(db: Session = Depends(get_db)):
    """Per-client assignment stats for the dashboard."""
    clientes = db.query(Cliente).filter(Cliente.activo == True).all()
    resultado = []

    for c in clientes:
        total = db.query(func.count(AsignacionCapacitacion.id)).filter(
            AsignacionCapacitacion.cliente_id == c.id
        ).scalar() or 0

        if total == 0:
            continue  # Skip clients with no assignments

        completadas = db.query(func.count(AsignacionCapacitacion.id)).filter(
            AsignacionCapacitacion.cliente_id == c.id,
            AsignacionCapacitacion.estado == "aprobado"
        ).scalar() or 0

        pendientes = total - completadas
        porcentaje = round((completadas / total) * 100) if total > 0 else 0

        resultado.append({
            "id": c.id,
            "razon_social": c.razon_social,
            "total": total,
            "pendientes": pendientes,
            "completadas": completadas,
            "porcentaje": porcentaje
        })

    # Sort by most assignments first
    resultado.sort(key=lambda x: x["total"], reverse=True)
    return resultado[:6]  # Top 6 clients
