from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import or_
from app.db.database import get_db
from app.models.domain import Empleado, Cliente, Area, AsignacionCapacitacion, Intento, Certificado, Capacitacion, CapacitacionProgramada
from app.core.security import get_current_user_uid
from pydantic import BaseModel
from typing import List
from datetime import datetime, timezone
import csv
import io

router = APIRouter()

# Router separado para endpoints del portal de empleados (/me/*)
# Se registra SIN la dependencia de admin en main.py
employee_router = APIRouter()

def get_current_empleado(current_uid: str = Depends(get_current_user_uid), db: Session = Depends(get_db)):
    """Resolves the current employee from the UID in the JWT."""
    if not current_uid:
        raise HTTPException(status_code=401, detail="No autenticado")
        
    empleado = None
    if str(current_uid).startswith("EMP-"):
        try:
            emp_id = int(str(current_uid).replace("EMP-", ""))
            empleado = db.query(Empleado).filter(Empleado.id == emp_id).first()
        except:
            pass
    else:
        empleado = db.query(Empleado).filter(Empleado.uid_firebase == current_uid).first()
        
    if not empleado:
        raise HTTPException(status_code=401, detail="Empleado no encontrado o sesiÃ³n expirada")
        
    return empleado

class EmpleadoCreate(BaseModel):
    nombre_completo: str
    email: str | None = None
    cliente_id: int
    dni: str | None = None
    activo: bool = True
    area_id: int | None = None

class EmpleadoResponse(BaseModel):
    id: int
    nombre_completo: str
    email: str | None = None
    cliente_id: int
    dni: str | None = None
    activo: bool
    area_id: int | None = None
    area_nombre: str | None = None
    can_delete: bool | None = None
    can_deactivate: bool | None = None

    class Config:
        from_attributes = True

@router.get("/opciones/areas")
def get_areas_disponibles(db: Session = Depends(get_db)):
    areas = db.query(Area).all()
    if not areas:
        default_areas = ["Choferes", "AdministraciÃ³n", "DepÃ³sito", "Operaciones"]
        for nombre in default_areas:
            db.add(Area(nombre=nombre))
        db.commit()
        areas = db.query(Area).all()
    return [{"id": a.id, "nombre": a.nombre, "activo": True} for a in areas]

@router.get("/", response_model=List[EmpleadoResponse])
def get_empleados(cliente_id: int = None, db: Session = Depends(get_db)):
    query = db.query(Empleado)
    if cliente_id is not None:
        query = query.filter(Empleado.cliente_id == cliente_id)
    empleados = query.all()
    # Inject area_id from the first area (since frontend uses a 1-to-M style dropdown)
    for emp in empleados:
        if emp.areas:
            emp.area_id = emp.areas[0].id
            emp.area_nombre = emp.areas[0].nombre
        else:
            emp.area_id = None
            emp.area_nombre = None
            
        has_history = (
            db.query(AsignacionCapacitacion).filter(AsignacionCapacitacion.empleado_id == emp.id).first() is not None or
            db.query(Certificado).filter(Certificado.empleado_id == emp.id).first() is not None
        )
        emp.can_delete = not has_history
        emp.can_deactivate = not emp.can_delete and emp.activo
    return empleados

@router.get("/{empleado_id}")
def get_empleado(empleado_id: int, db: Session = Depends(get_db)):
    empleado = db.query(Empleado).filter(Empleado.id == empleado_id).first()
    if not empleado:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
        
    cliente = db.query(Cliente).filter(Cliente.id == empleado.cliente_id).first()
    
    # Real training history
    from app.models.domain import AsignacionCapacitacion, Certificado, Intento
    
    asignaciones = db.query(AsignacionCapacitacion).filter(AsignacionCapacitacion.empleado_id == empleado_id).all()
    
    capacitaciones_asignadas = []
    certificados_res = []
    
    for asig in asignaciones:
        # Get the best attempt score
        mejor_intento = db.query(Intento).filter(
            Intento.asignacion_id == asig.id,
            Intento.estado == "FINALIZADO"
        ).order_by(Intento.nota_final.desc()).first()
        
        # Get the certificate if it exists
        cert = db.query(Certificado).filter(
            Certificado.asignacion_id == asig.id
        ).first()
        
        prog = asig.programada
        cap_str = f"{asig.capacitacion.nombre} ({prog.mes}/{prog.anio} - {prog.tipo})" if prog and asig.capacitacion else (asig.capacitacion.nombre if asig.capacitacion else "N/A")

        asig_data = {
            "id": asig.id,
        "capacitacion_id": asig.capacitacion_id,
            "curso_id": asig.capacitacion_id, 
            "capacitacion": cap_str,
            "fecha": asig.fecha_asignacion.strftime('%d/%m/%Y') if asig.fecha_asignacion else "N/A",
            "estado": asig.estado.capitalize(),
            "nota": round(mejor_intento.nota_final, 1) if mejor_intento and mejor_intento.nota_final is not None else "N/A"
        }
        capacitaciones_asignadas.append(asig_data)
        
        if cert:
            certificados_res.append({
                "id": cert.id,
                "capacitacion": asig_data["capacitacion"],
                "hash": cert.hash_verificacion,
                "vencimiento": cert.fecha_vencimiento.strftime('%d/%m/%Y') if cert.fecha_vencimiento else "N/A"
            })

    has_history = (
        len(asignaciones) > 0 or
        db.query(Certificado).filter(Certificado.empleado_id == empleado.id).first() is not None
    )
    can_delete = not has_history
    
    return {
        "id": empleado.id,
        "nombre_completo": empleado.nombre_completo,
        "dni": empleado.dni,
        "email": empleado.email,
        "activo": empleado.activo,
        "cliente_id": empleado.cliente_id,
        "area_id": empleado.areas[0].id if empleado.areas else None,
        "area_nombre": empleado.areas[0].nombre if empleado.areas else None,
        "cliente": {
            "razon_social": cliente.razon_social if cliente else "Sin empresa asignada"
        },
        "capacitaciones_asignadas": capacitaciones_asignadas,
        "certificados": certificados_res,
        "can_delete": can_delete,
        "can_deactivate": not can_delete and empleado.activo
    }

# â”€â”€â”€ DELETION & ARCHIVING â”€â”€â”€

@router.delete("/{empleado_id}")
def delete_empleado(empleado_id: int, db: Session = Depends(get_db)):
    empleado = db.query(Empleado).filter(Empleado.id == empleado_id).first()
    if not empleado:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
        
    has_history = (
        db.query(AsignacionCapacitacion).filter(AsignacionCapacitacion.empleado_id == empleado.id).first() is not None or
        db.query(Certificado).filter(Certificado.empleado_id == empleado.id).first() is not None
    )
    
    if has_history:
        raise HTTPException(status_code=400, detail="This entity cannot be deleted because it has operational history.")
        
    db.delete(empleado)
    db.commit()
    return {"message": "Empleado eliminado permanentemente"}

@router.patch("/{empleado_id}/baja")
def baja_empleado(empleado_id: int, db: Session = Depends(get_db)):
    empleado = db.query(Empleado).filter(Empleado.id == empleado_id).first()
    if not empleado:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
        
    empleado.activo = False
    db.commit()
    return {"message": "Empleado dado de baja correctamente"}

@router.post("/", response_model=EmpleadoResponse)
def create_empleado(empleado: EmpleadoCreate, db: Session = Depends(get_db)):
    cliente = db.query(Cliente).filter(Cliente.id == empleado.cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
        
    if empleado.dni:
        existente = db.query(Empleado).filter(Empleado.dni == empleado.dni, Empleado.cliente_id == empleado.cliente_id).first()
        if existente:
            print("El empleado ya existe rey")
            raise HTTPException(status_code=400, detail="Ya existe un empleado con este DNI en este cliente.")
            
    if empleado.email:
        existente_email = db.query(Empleado).filter(Empleado.email == empleado.email, Empleado.cliente_id == empleado.cliente_id).first()
        if existente_email:
            print("el mail ya existe")
            raise HTTPException(status_code=400, detail="Ya existe un empleado con este Email en este cliente.")
            
    create_data = empleado.model_dump(exclude={"area_id"})
    db_empleado = Empleado(**create_data)
    
    if empleado.area_id:
        area = db.query(Area).filter(Area.id == empleado.area_id).first()
        if not area:
            raise HTTPException(status_code=400, detail="El Ã¡rea especificada no existe.")
            
        # Verify area belongs to client (M2M) using the loaded relationship
        if not any(a.id == area.id for a in cliente.areas):
            raise HTTPException(status_code=400, detail="El Ã¡rea no estÃ¡ habilitada para este cliente.")
            
        db_empleado.areas.append(area)

    db.add(db_empleado)
    db.commit()
    db.refresh(db_empleado)
    
    if db_empleado.areas:
        setattr(db_empleado, 'area_id', db_empleado.areas[0].id)
        setattr(db_empleado, 'area_nombre', db_empleado.areas[0].nombre)
    else:
        setattr(db_empleado, 'area_id', None)
        setattr(db_empleado, 'area_nombre', None)
        
    return db_empleado

@router.put("/{empleado_id}", response_model=EmpleadoResponse)
def update_empleado(empleado_id: int, empleado: EmpleadoCreate, db: Session = Depends(get_db)):
    db_empleado = db.query(Empleado).filter(Empleado.id == empleado_id).first()
    if not db_empleado:
        raise HTTPException(status_code=404, detail="Empleado no encontrado")
        
    cliente = db.query(Cliente).filter(Cliente.id == empleado.cliente_id).first()
    if not cliente:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")
        
    if empleado.dni:
        existente_dni = db.query(Empleado).filter(
            Empleado.dni == empleado.dni, 
            Empleado.cliente_id == empleado.cliente_id,
            Empleado.id != empleado_id
        ).first()
        
        if existente_dni:
            raise HTTPException(status_code=400, detail="Ya existe otro empleado con este DNI en este cliente.")
            
    if empleado.email:
        existente_email = db.query(Empleado).filter(
            Empleado.email == empleado.email, 
            Empleado.cliente_id == empleado.cliente_id,
            Empleado.id != empleado_id
        ).first()
        
        if existente_email:
            raise HTTPException(status_code=400, detail="Ya existe otro empleado con este Email en este cliente.")
            
    # Remove None items if you wish, or just bulk update
    update_data = empleado.model_dump(exclude={"area_id"})
    for key, value in update_data.items():
        setattr(db_empleado, key, value)
        
    if empleado.area_id is not None:
        area = db.query(Area).filter(Area.id == empleado.area_id).first()
        if not area:
            raise HTTPException(status_code=400, detail="El Ã¡rea especificada no existe.")
            
        # Verify area belongs to client (M2M) using the loaded relationship
        if not any(a.id == area.id for a in cliente.areas):
            raise HTTPException(status_code=400, detail="El Ã¡rea no estÃ¡ habilitada para este cliente o no existe.")
            
        db_empleado.areas = [area]
    else:
        db_empleado.areas = []
        
    db.commit()
    db.refresh(db_empleado)
    
    if db_empleado.areas:
        setattr(db_empleado, 'area_id', db_empleado.areas[0].id)
        setattr(db_empleado, 'area_nombre', db_empleado.areas[0].nombre)
    else:
        setattr(db_empleado, 'area_id', None)
        setattr(db_empleado, 'area_nombre', None)
        
    return db_empleado


@router.post("/bulk")
async def bulk_upload_empleados(
    file: UploadFile = File(...),
    cliente_id: int = None,
    db: Session = Depends(get_db)
):
    """
    Import employees from CSV or Excel (.xlsx/.xls).
    
    Expected columns (case-insensitive, flexible names):
      - nombre / nombre_completo (required)
      - apellido (optional, concatenated with nombre)
      - dni / documento (required)
      - email / correo (optional)
      - empresa_id / cliente_id (optional if cliente_id query param is provided)
      - area / area_nombre (optional, matched by name)
    
    If `cliente_id` is provided as a query parameter, it applies to all rows
    and overrides any empresa_id column in the file.
    """
    filename = file.filename.lower()
    content = await file.read()
    
    # â”€â”€ Parse rows from file â”€â”€
    rows = []
    if filename.endswith(".csv"):
        try:
            decoded = content.decode("utf-8")
        except UnicodeDecodeError:
            decoded = content.decode("latin1")
        reader = csv.DictReader(io.StringIO(decoded))
        for row in reader:
            rows.append(row)
    elif filename.endswith((".xlsx", ".xls")):
        try:
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(content), read_only=True)
            ws = wb.active
            headers = []
            for i, row in enumerate(ws.iter_rows(values_only=True)):
                if i == 0:
                    headers = [str(h).strip() if h else f"col_{j}" for j, h in enumerate(row)]
                    continue
                if all(c is None for c in row):
                    continue
                rows.append(dict(zip(headers, [str(v).strip() if v is not None else "" for v in row])))
            wb.close()
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Error al leer el archivo Excel: {str(e)}")
    else:
        raise HTTPException(status_code=400, detail="Solo se permiten archivos .csv, .xlsx o .xls")
    
    if not rows:
        raise HTTPException(status_code=400, detail="El archivo estÃ¡ vacÃ­o o no tiene datos vÃ¡lidos.")
    
    # â”€â”€ Normalize column names â”€â”€
    COLUMN_ALIASES = {
        "nombre": ["nombre", "nombre_completo", "name", "nombres"],
        "apellido": ["apellido", "apellidos", "last_name"],
        "dni": ["dni", "documento", "doc", "document", "nro_documento", "numero_documento"],
        "email": ["email", "correo", "mail", "e-mail", "correo_electronico"],
        "empresa_id": ["empresa_id", "cliente_id", "empresa", "cliente", "company_id"],
        "area": ["area", "area_nombre", "sector", "departamento"],
    }
    
    def resolve_columns(row_keys):
        """Map actual column names to canonical names."""
        mapping = {}
        normalized_keys = {k.lower().strip(): k for k in row_keys if k}
        for canonical, aliases in COLUMN_ALIASES.items():
            for alias in aliases:
                if alias in normalized_keys:
                    mapping[canonical] = normalized_keys[alias]
                    break
        return mapping
    
    col_map = resolve_columns(rows[0].keys()) if rows else {}
    
    # Validate required columns exist
    if "nombre" not in col_map:
        raise HTTPException(status_code=400, detail=f"No se encontrÃ³ la columna 'Nombre' o 'Nombre_Completo'. Columnas detectadas: {list(rows[0].keys())}")
    if "dni" not in col_map:
        raise HTTPException(status_code=400, detail=f"No se encontrÃ³ la columna 'DNI' o 'Documento'. Columnas detectadas: {list(rows[0].keys())}")
    if not cliente_id and "empresa_id" not in col_map:
        raise HTTPException(status_code=400, detail="Debe especificar el cliente_id como parÃ¡metro o incluir una columna 'empresa_id' / 'cliente_id' en el archivo.")
    
    # Pre-load areas for name matching
    all_areas = db.query(Area).all()
    area_name_map = {a.nombre.lower().strip(): a for a in all_areas}
    
    # â”€â”€ Process rows â”€â”€
    created = 0
    skipped = 0
    errors_list = []
    
    for i, row in enumerate(rows, start=2):  # start=2 because row 1 is headers
        try:
            nombre = row.get(col_map.get("nombre", ""), "").strip()
            apellido = row.get(col_map.get("apellido", ""), "").strip()
            dni = row.get(col_map.get("dni", ""), "").strip()
            email = row.get(col_map.get("email", ""), "").strip()
            area_name = row.get(col_map.get("area", ""), "").strip()
            
            # Determine empresa_id
            row_empresa_id = cliente_id
            if not row_empresa_id:
                empresa_str = row.get(col_map.get("empresa_id", ""), "").strip()
                if not empresa_str:
                    errors_list.append({"fila": i, "motivo": "Sin empresa_id"})
                    continue
                try:
                    row_empresa_id = int(float(empresa_str))
                except (ValueError, TypeError):
                    errors_list.append({"fila": i, "motivo": f"empresa_id invÃ¡lido: '{empresa_str}'"})
                    continue
            
            # Clean DNI (remove dots, spaces)
            dni = dni.replace(".", "").replace(" ", "").replace("-", "")
            
            if not nombre:
                errors_list.append({"fila": i, "motivo": "Nombre vacÃ­o"})
                continue
            if not dni:
                errors_list.append({"fila": i, "motivo": "DNI vacÃ­o"})
                continue
            
            nombre_completo = f"{nombre} {apellido}".strip()
            
            # Check for duplicates
            existente = db.query(Empleado).filter(
                Empleado.dni == dni,
                Empleado.cliente_id == row_empresa_id
            ).first()
            
            if existente:
                skipped += 1
                continue
            
            nuevo_emp = Empleado(
                nombre_completo=nombre_completo,
                apellido=apellido if apellido else None,
                dni=dni,
                email=email if email else None,
                cliente_id=row_empresa_id
            )
            
            # Area matching by name
            if area_name:
                area_obj = area_name_map.get(area_name.lower().strip())
                if area_obj:
                    nuevo_emp.areas.append(area_obj)
            
            db.add(nuevo_emp)
            created += 1
            
        except Exception as e:
            errors_list.append({"fila": i, "motivo": str(e)})
    
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error al guardar en la base de datos: {str(e)}")
    
    # ── AUTO-ASSIGN: Re-trigger assignments for ACTIVA programadas of affected clients ──
    auto_asignaciones = 0
    if created > 0:
        from app.api.endpoints.plan_anual import trigger_asigacion_masiva
        affected_clients = set()
        if cliente_id:
            affected_clients.add(cliente_id)
        else:
            for row in rows:
                empresa_str = row.get(col_map.get("empresa_id", ""), "").strip()
                if empresa_str:
                    try:
                        affected_clients.add(int(float(empresa_str)))
                    except:
                        pass
        
        for cid in affected_clients:
            activas = db.query(CapacitacionProgramada).filter(
                CapacitacionProgramada.cliente_id == cid,
                CapacitacionProgramada.estado == "ACTIVA"
            ).all()
            for prog in activas:
                auto_asignaciones += trigger_asigacion_masiva(db, prog)
    
    return {
        "created": created,
        "skipped": skipped,
        "errors": len(errors_list),
        "error_details": errors_list[:20],
        "total_rows": len(rows),
        "columns_detected": list(col_map.keys()),
        "auto_asignaciones": auto_asignaciones
    }

def map_asignacion_to_ui(asig: AsignacionCapacitacion, db: Session):
    """Derive the 6-state UI status from assignment tracking fields.
    States: ASSIGNED â†’ IN_PROGRESS â†’ PENDING_EVALUATION â†’ APPROVED â†’ COMPLETED â†’ CERTIFIED
    """
    now = datetime.now(timezone.utc)
    
    # Start with base state
    estado_ui = "ASSIGNED"
    puede_comenzar = True
    puede_continuar = False
    puede_marcar_completada = False
    intento_id = None
    certificado_id = None
    certificado_hash = None
    certificado_vigente = False

    # Get the programada to resolve modalidad + requiere_evaluacion
    prog = asig.programada
    modalidad = prog.modalidad_final if prog else (asig.capacitacion.modalidad if asig.capacitacion else "presencial")
    requiere_evaluacion = prog.requiere_evaluacion_final if prog else (asig.capacitacion.requiere_evaluacion if asig.capacitacion else True)

    # 1. Check for certificate â†’ CERTIFIED
    cert = db.query(Certificado).filter(Certificado.asignacion_id == asig.id).first()
    if cert:
        certificado_id = cert.id
        certificado_hash = cert.hash_verificacion
        venc = cert.fecha_vencimiento
        if venc:
            if venc.tzinfo is None:
                venc = venc.replace(tzinfo=timezone.utc)
            if venc < now:
                estado_ui = "VENCIDO"
            else:
                estado_ui = "CERTIFIED"
                certificado_vigente = True
                puede_comenzar = False
        return {
            "id": asig.id,
        "capacitacion_id": asig.capacitacion_id,
            "nombre": asig.capacitacion.nombre if asig.capacitacion else "N/A",
            "estado_ui": estado_ui,
            "requiere_evaluacion": requiere_evaluacion,
            "modalidad": modalidad,
            "puede_comenzar": False,
            "puede_continuar": False,
            "puede_marcar_completada": False,
            "intento_id": intento_id,
            "certificado_id": certificado_id,
            "certificado_hash": certificado_hash,
            "certificado_vigente": certificado_vigente,
            "duracion_estimada": f"{asig.capacitacion.duracion_horas}h" if asig.capacitacion else "N/A",
            "material_viewed": asig.material_viewed_at is not None,
            "completion_method": asig.completion_method,
            "completed_at": asig.completed_at.isoformat() if asig.completed_at else None,
        }

    # 2. Check if completed â†’ COMPLETED (awaiting certificate or no cert needed)
    if asig.completed_at:
        estado_ui = "COMPLETED"
        puede_comenzar = False
        puede_continuar = False

    # 3. Check evaluation state
    elif requiere_evaluacion:
        ultimo_intento = db.query(Intento).filter(
            Intento.asignacion_id == asig.id
        ).order_by(Intento.fecha_inicio.desc()).first()
        
        if ultimo_intento:
            if ultimo_intento.estado == "EN_CURSO":
                estado_ui = "IN_PROGRESS"
                puede_continuar = True
                intento_id = ultimo_intento.id
                puede_comenzar = False
            elif ultimo_intento.aprobado:
                estado_ui = "APPROVED"
                puede_comenzar = False
            else:
                # Failed attempt â€” can retry
                estado_ui = "PENDING_EVALUATION"
                puede_comenzar = True
        elif asig.material_viewed_at:
            estado_ui = "PENDING_EVALUATION"
        elif asig.evaluation_started_at:
            estado_ui = "IN_PROGRESS"
    
    # 4. No evaluation required
    else:
        if asig.material_viewed_at:
            estado_ui = "IN_PROGRESS"
            # Virtual trainings without evaluation â†’ employee can mark completed
            if modalidad == "virtual":
                puede_marcar_completada = True
        # Presential â†’ admin marks attendance, employee just sees status
        if modalidad == "presencial" and asig.asistio:
            estado_ui = "COMPLETED"
            puede_comenzar = False

    return {
        "id": asig.id,
        "capacitacion_id": asig.capacitacion_id,
        "nombre": asig.capacitacion.nombre if asig.capacitacion else "N/A",
        "estado_ui": estado_ui,
        "requiere_evaluacion": requiere_evaluacion,
        "modalidad": modalidad,
        "puede_comenzar": puede_comenzar,
        "puede_continuar": puede_continuar,
        "puede_marcar_completada": puede_marcar_completada,
        "intento_id": intento_id,
        "certificado_id": certificado_id,
        "certificado_hash": certificado_hash,
        "certificado_vigente": certificado_vigente,
        "duracion_estimada": f"{asig.capacitacion.duracion_horas}h" if asig.capacitacion else "N/A",
        "material_viewed": asig.material_viewed_at is not None,
        "completion_method": asig.completion_method,
        "completed_at": asig.completed_at.isoformat() if asig.completed_at else None,
    }

@employee_router.get("/me/capacitaciones")
def get_my_capacitaciones(empleado: Empleado = Depends(get_current_empleado), db: Session = Depends(get_db)):
    # Employees see: ACTIVA (in-progress), FINALIZADA (completed), and legacy CERRADA data
    # They do NOT see PROGRAMADA or CANCELADA assignments
    asignaciones = db.query(AsignacionCapacitacion).outerjoin(CapacitacionProgramada).filter(
        AsignacionCapacitacion.empleado_id == empleado.id,
        or_(
            CapacitacionProgramada.estado.in_(["ACTIVA", "FINALIZADA", "CERRADA"]),
            AsignacionCapacitacion.programada_id == None  # Legacy assignments without programada
        )
    ).all()
    
    return [map_asignacion_to_ui(asig, db) for asig in asignaciones]

@employee_router.get("/me/progreso")
def get_my_progreso(empleado: Empleado = Depends(get_current_empleado), db: Session = Depends(get_db)):
    total_asignadas = db.query(AsignacionCapacitacion).filter(
        AsignacionCapacitacion.empleado_id == empleado.id
    ).count()
    
    # Progress is based on valid (not expired) certificates
    now = datetime.now(timezone.utc)
    certs = db.query(Certificado).filter(Certificado.empleado_id == empleado.id).all()
    
    total_completadas = 0
    for c in certs:
        venc = c.fecha_vencimiento
        if venc and venc.tzinfo is None:
            venc = venc.replace(tzinfo=timezone.utc)
            
        if venc and venc >= now:
            total_completadas += 1
    
    porcentaje = 0
    if total_asignadas > 0:
        porcentaje = round((total_completadas / total_asignadas) * 100)
    
    return {
        "total_asignadas": total_asignadas,
        "total_completadas": total_completadas,
        "porcentaje_cumplimiento": porcentaje
    }

@employee_router.get("/me/certificados")
def get_my_certificados(empleado: Empleado = Depends(get_current_empleado), db: Session = Depends(get_db)):
    certs = db.query(Certificado).filter(Certificado.empleado_id == empleado.id).all()
    
    res = []
    for c in certs:
        res.append({
            "id": c.id,
            "hash": c.hash_verificacion,
            "capacitacion": c.capacitacion.nombre if c.capacitacion else "N/A",
            "fecha_emision": c.fecha_emision.strftime("%Y-%m-%d") if c.fecha_emision else "N/A",
            "fecha_vencimiento": c.fecha_vencimiento.strftime("%Y-%m-%d") if c.fecha_vencimiento else "N/A",
            "estado": c.estado
        })
    return res

# â”€â”€â”€ New: Mark Material Viewed â”€â”€â”€

@employee_router.post("/me/capacitaciones/{asignacion_id}/mark-material-viewed")
def mark_material_viewed(asignacion_id: int, empleado: Empleado = Depends(get_current_empleado), db: Session = Depends(get_db)):
    """Mark that the employee has viewed the training materials. Does NOT complete the training."""
    asig = db.query(AsignacionCapacitacion).filter(
        AsignacionCapacitacion.id == asignacion_id,
        AsignacionCapacitacion.empleado_id == empleado.id
    ).first()
    
    if not asig:
        raise HTTPException(status_code=404, detail="AsignaciÃ³n no encontrada")
    
    # Idempotent: only set if not already set
    if not asig.material_viewed_at:
        asig.material_viewed_at = datetime.now(timezone.utc)
        db.commit()
    
    return {"message": "Material marcado como visto", "material_viewed_at": asig.material_viewed_at.isoformat()}

# â”€â”€â”€ New: Mark Completed (virtual, no-eval only) â”€â”€â”€

@employee_router.post("/me/capacitaciones/{asignacion_id}/mark-completed")
def mark_completed(asignacion_id: int, empleado: Empleado = Depends(get_current_empleado), db: Session = Depends(get_db)):
    """Mark training as completed manually. Only for virtual trainings without evaluation."""
    asig = db.query(AsignacionCapacitacion).filter(
        AsignacionCapacitacion.id == asignacion_id,
        AsignacionCapacitacion.empleado_id == empleado.id
    ).first()
    
    if not asig:
        raise HTTPException(status_code=404, detail="AsignaciÃ³n no encontrada")
    
    # Idempotent guard
    if asig.completed_at:
        return {"message": "Ya fue marcada como completada", "completed_at": asig.completed_at.isoformat()}
    
    # Resolve from programada or catalog
    prog = asig.programada
    requiere_eval = prog.requiere_evaluacion_final if prog else (asig.capacitacion.requiere_evaluacion if asig.capacitacion else True)
    modalidad = prog.modalidad_final if prog else (asig.capacitacion.modalidad if asig.capacitacion else "presencial")
    
    if requiere_eval:
        raise HTTPException(status_code=400, detail="Esta capacitaciÃ³n requiere evaluaciÃ³n. No se puede marcar manualmente.")
    
    if modalidad == "presencial":
        raise HTTPException(status_code=400, detail="Capacitaciones presenciales requieren registro de asistencia del administrador.")
    
    asig.completed_at = datetime.now(timezone.utc)
    asig.completion_method = "MANUAL_CONFIRMATION"
    asig.estado = "aprobado"
    db.commit()
    
    return {"message": "CapacitaciÃ³n marcada como completada", "completed_at": asig.completed_at.isoformat()}

# â”€â”€â”€ New: Employee Signature â”€â”€â”€

class FirmaRequest(BaseModel):
    firma_base64: str

@employee_router.post("/me/firma")
def upload_firma(req: FirmaRequest, empleado: Empleado = Depends(get_current_empleado), db: Session = Depends(get_db)):
    """Upload or update the employee's digital signature."""
    empleado.firma_base64 = req.firma_base64
    db.commit()
    return {"message": "Firma guardada correctamente"}

@employee_router.get("/me/firma")
def get_firma(empleado: Empleado = Depends(get_current_empleado), db: Session = Depends(get_db)):
    """Get the employee's current digital signature."""
    return {"firma_base64": empleado.firma_base64}

