from sqlalchemy import Column, Integer, String, Text, ForeignKey, Boolean, DateTime, Float, Table, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
from app.db.database import Base

# ─── Many-to-Many Tables ───

empleado_areas = Table(
    'empleado_areas',
    Base.metadata,
    Column('empleado_id', Integer, ForeignKey('empleados.id', ondelete="CASCADE"), primary_key=True),
    Column('area_id', Integer, ForeignKey('areas.id', ondelete="CASCADE"), primary_key=True)
)

cliente_areas = Table(
    'cliente_areas',
    Base.metadata,
    Column('cliente_id', Integer, ForeignKey('clientes.id', ondelete="CASCADE"), primary_key=True),
    Column('area_id', Integer, ForeignKey('areas.id', ondelete="CASCADE"), primary_key=True)
)



# ─── Plan Anual y Programadas ───

class PlanAnualCliente(Base):
    __tablename__ = "planes_anuales_cliente"
    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False)
    anio = Column(Integer, nullable=False)
    estado = Column(String(50), default="BORRADOR") # BORRADOR, APROBADO, ARCHIVADO
    observaciones = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    __table_args__ = (
        UniqueConstraint('cliente_id', 'anio', name='uix_cliente_anio_plan'),
    )

    cliente = relationship("Cliente")
    items = relationship("PlanAnualItem", back_populates="plan", cascade="all, delete-orphan")

class PlanAnualItem(Base):
    __tablename__ = "plan_anual_items"
    id = Column(Integer, primary_key=True, index=True)
    plan_anual_id = Column(Integer, ForeignKey("planes_anuales_cliente.id", ondelete="CASCADE"), nullable=False)
    capacitacion_id = Column(Integer, ForeignKey("catalogo_capacitaciones.id", ondelete="RESTRICT"), nullable=False)
    mes = Column(Integer, nullable=False)
    tipo = Column(String(50), nullable=False) # ANUAL, COMPLEMENTARIA
    modalidad_override = Column(String(50), nullable=True)
    requiere_evaluacion_override = Column(Boolean, nullable=True)
    activo = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    plan = relationship("PlanAnualCliente", back_populates="items")
    capacitacion = relationship("Capacitacion")

class CapacitacionProgramada(Base):
    __tablename__ = "capacitaciones_programadas"
    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id", ondelete="CASCADE"), nullable=False)
    capacitacion_id = Column(Integer, ForeignKey("catalogo_capacitaciones.id", ondelete="RESTRICT"), nullable=False)
    plan_item_id = Column(Integer, ForeignKey("plan_anual_items.id", ondelete="SET NULL"), nullable=True)
    
    mes = Column(Integer, nullable=False)
    anio = Column(Integer, nullable=False)
    fecha_programada = Column(DateTime, nullable=True)
    fecha_activacion = Column(DateTime, nullable=True)
    fecha_cierre = Column(DateTime, nullable=True)
    
    tipo = Column(String(50), nullable=False) # ANUAL, COMPLEMENTARIA, EVENTUAL, LEGACY
    modalidad_final = Column(String(50), nullable=False)
    requiere_evaluacion_final = Column(Boolean, nullable=False)
    
    estado = Column(String(50), default="PROGRAMADA") # PROGRAMADA → ACTIVA → FINALIZADA | CANCELADA
    generada_automaticamente = Column(Boolean, default=True)
    alcance_asignacion = Column(String(50), default="TODOS") # TODOS o SUBCONJUNTO
    empleados_incluidos = Column(Text, nullable=True) # JSON si es SUBCONJUNTO
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint('cliente_id', 'capacitacion_id', 'mes', 'anio', 'tipo', name='uix_programada_idempotency'),
    )

    cliente = relationship("Cliente")
    capacitacion = relationship("Capacitacion")
    asignaciones = relationship("AsignacionCapacitacion", back_populates="programada", cascade="all, delete-orphan")

# ─── Asignacion (replaces Session-based workflow) ───

class AsignacionCapacitacion(Base):
    __tablename__ = "asignaciones_capacitacion"
    id = Column(Integer, primary_key=True, index=True)
    cliente_id = Column(Integer, ForeignKey('clientes.id', ondelete="CASCADE"), nullable=False)
    empleado_id = Column(Integer, ForeignKey('empleados.id', ondelete="CASCADE"), nullable=False)
    capacitacion_id = Column(Integer, ForeignKey('catalogo_capacitaciones.id', ondelete="CASCADE"), nullable=False)
    
    programada_id = Column(Integer, ForeignKey('capacitaciones_programadas.id', ondelete="CASCADE"), nullable=True)
    
    estado = Column(String(50), default="pendiente")  # pendiente, en_curso, aprobado, desaprobado
    origen = Column(String(50), default="masiva")  # masiva, manual
    fecha_asignacion = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    # ─── Completion tracking fields ───
    material_viewed_at = Column(DateTime, nullable=True)
    evaluation_started_at = Column(DateTime, nullable=True)
    evaluation_completed_at = Column(DateTime, nullable=True)
    evaluation_score = Column(Float, nullable=True)
    evaluation_passed = Column(Boolean, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    completion_method = Column(String(50), nullable=True)  # EVALUATION, MANUAL_CONFIRMATION, ATTENDANCE, ADMIN_OVERRIDE
    asistio = Column(Boolean, nullable=True)  # Attendance for presential trainings
    
    __table_args__ = (
        UniqueConstraint('empleado_id', 'programada_id', name='uix_empleado_programada_asignacion'),
    )

    empleado = relationship("Empleado", backref="asignaciones")
    capacitacion = relationship("Capacitacion", backref="asignaciones_empleados")
    programada = relationship("CapacitacionProgramada", back_populates="asignaciones")
    cliente = relationship("Cliente")

# ─── Core Entities ───

class Cliente(Base):
    __tablename__ = "clientes"
    id = Column(Integer, primary_key=True, index=True)
    razon_social = Column(String(255), nullable=False, unique=True, index=True)
    cuit = Column(String(50), nullable=False, unique=True, index=True)
    rubro_id = Column(Integer, ForeignKey("rubros.id", ondelete="SET NULL"), nullable=True)
    activo = Column(Boolean, default=True)
    
    rubro = relationship("Rubro", back_populates="clientes")
    areas = relationship("Area", secondary=cliente_areas, back_populates="clientes")
    empleados = relationship("Empleado", back_populates="cliente", cascade="all, delete-orphan")


class Rubro(Base):
    __tablename__ = "rubros"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(255), nullable=False, unique=True)
    activo = Column(Boolean, default=True)
    
    clientes = relationship("Cliente", back_populates="rubro")
    capacitaciones = relationship("Capacitacion", back_populates="rubro")

class Area(Base):
    __tablename__ = "areas"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(255), nullable=False, unique=True)
    activo = Column(Boolean, default=True)
    
    clientes = relationship("Cliente", secondary=cliente_areas, back_populates="areas")
    empleados = relationship("Empleado", secondary=empleado_areas, back_populates="areas")

class Empleado(Base):
    __tablename__ = "empleados"
    id = Column(Integer, primary_key=True, index=True)
    nombre_completo = Column(String(255), nullable=False)
    apellido = Column(String(255), nullable=True)
    dni = Column(String(50), nullable=True, index=True)
    email = Column(String(255), nullable=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id", ondelete="CASCADE"))
    uid_firebase = Column(String(128), unique=True, nullable=True)
    activo = Column(Boolean, default=True)
    firma_base64 = Column(Text, nullable=True)  # Digital signature image
    
    __table_args__ = (
        UniqueConstraint('cliente_id', 'dni', name='uix_cliente_empleado_dni'),
    )

    cliente = relationship("Cliente", back_populates="empleados")
    areas = relationship("Area", secondary=empleado_areas, back_populates="empleados")
    certificados = relationship("Certificado", back_populates="empleado", cascade="all, delete-orphan")

# ─── Training Catalog ───

class Capacitacion(Base):
    __tablename__ = "catalogo_capacitaciones"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(255), nullable=False)
    descripcion = Column(Text, nullable=True)
    duracion_horas = Column(Integer, default=1)
    modalidad = Column(String(50), default="presencial")  # presencial, virtual, mixta
    requiere_evaluacion = Column(Boolean, default=True)
    puntaje_total = Column(Float, default=10.0)
    puntaje_aprobacion = Column(Float, default=7.5)
    meses_vigencia = Column(Integer, default=12)
    activa = Column(Boolean, default=True)
    rubro_id = Column(Integer, ForeignKey("rubros.id", ondelete="SET NULL"), nullable=True)
    area_id = Column(Integer, ForeignKey("areas.id", ondelete="SET NULL"), nullable=True)
    
    rubro = relationship("Rubro", back_populates="capacitaciones")
    area = relationship("Area")
    materiales = relationship("Material", back_populates="capacitacion", cascade="all, delete-orphan")
    preguntas = relationship("Pregunta", back_populates="capacitacion")

class Material(Base):
    __tablename__ = "materiales_capacitacion"
    id = Column(Integer, primary_key=True, index=True)
    titulo = Column(String(255), nullable=False)
    descripcion = Column(String(500), nullable=True)
    tipo = Column(String(50), default="link")  # pdf, video, imagen, link
    url = Column(String(500), nullable=False)
    orden = Column(Integer, default=1)
    activo = Column(Boolean, default=True)
    capacitacion_id = Column(Integer, ForeignKey("catalogo_capacitaciones.id"))
    
    capacitacion = relationship("Capacitacion", back_populates="materiales")

# ─── Evaluation Engine ───

class Evaluacion(Base):
    __tablename__ = "evaluaciones"
    id = Column(Integer, primary_key=True, index=True)
    asignacion_id = Column(Integer, ForeignKey("asignaciones_capacitacion.id"), nullable=True)
    activa = Column(Boolean, default=True)
    
    asignacion = relationship("AsignacionCapacitacion", backref="evaluaciones")
    intentos = relationship("Intento", back_populates="evaluacion")

class Pregunta(Base):
    __tablename__ = "preguntas"
    id = Column(Integer, primary_key=True, index=True)
    capacitacion_id = Column(Integer, ForeignKey("catalogo_capacitaciones.id"))
    texto = Column(Text, nullable=False)
    opciones_json = Column(Text, nullable=False)  # [{ "id": 1, "texto": "...", "es_correcta": true }]
    
    capacitacion = relationship("Capacitacion", back_populates="preguntas")

class Intento(Base):
    __tablename__ = "intentos"
    id = Column(Integer, primary_key=True, index=True)
    evaluacion_id = Column(Integer, ForeignKey("evaluaciones.id"))
    asignacion_id = Column(Integer, ForeignKey("asignaciones_capacitacion.id"), nullable=True)
    fecha_inicio = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    fecha_fin = Column(DateTime, nullable=True)
    nota_final = Column(Float, nullable=True)
    aprobado = Column(Boolean, nullable=True)
    activo = Column(Boolean, default=True)
    estado = Column(String(50), default="PENDIENTE")
    
    evaluacion = relationship("Evaluacion", back_populates="intentos")
    asignacion = relationship("AsignacionCapacitacion", backref="intentos")
    respuestas = relationship("Respuesta", back_populates="intento")

class Respuesta(Base):
    __tablename__ = "respuestas"
    id = Column(Integer, primary_key=True, index=True)
    intento_id = Column(Integer, ForeignKey("intentos.id"))
    pregunta_id = Column(Integer, ForeignKey("preguntas.id"))
    opcion_elegida_id = Column(Integer, nullable=True)
    es_correcta = Column(Boolean, nullable=True)
    
    intento = relationship("Intento", back_populates="respuestas")

# ─── Certification ───

class Certificado(Base):
    __tablename__ = "certificados"
    id = Column(Integer, primary_key=True, index=True)
    empleado_id = Column(Integer, ForeignKey("empleados.id", ondelete="CASCADE"))
    asignacion_id = Column(Integer, ForeignKey("asignaciones_capacitacion.id", ondelete="CASCADE"), nullable=True)
    intento_id = Column(Integer, ForeignKey("intentos.id", ondelete="SET NULL"), nullable=True)
    cliente_id = Column(Integer, ForeignKey("clientes.id", ondelete="CASCADE"))
    capacitacion_id = Column(Integer, ForeignKey("catalogo_capacitaciones.id", ondelete="CASCADE"))
    
    hash_verificacion = Column(String(255), unique=True, nullable=False)
    fecha_emision = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    fecha_vencimiento = Column(DateTime, nullable=False)
    estado = Column(String(50), default="VIGENTE")
    archivo_url = Column(String(1024), nullable=True)
    
    # Signature snapshots — frozen at certificate creation time
    firma_empleado_snapshot = Column(Text, nullable=True)
    firma_capacitador_snapshot = Column(Text, nullable=True)

    empleado = relationship("Empleado", back_populates="certificados")
    asignacion = relationship("AsignacionCapacitacion")
    cliente = relationship("Cliente")
    capacitacion = relationship("Capacitacion")

# ─── Admin Users ───
    
class UsuarioConsultora(Base):
    __tablename__ = "usuarios_consultora"
    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    uid_firebase = Column(String(128), unique=True, nullable=True)  # Nullable ahora
    hashed_password = Column(String(255), nullable=True)  # JWT auth
    rol = Column(String(50), default="ADMIN")
    firma_base64 = Column(Text, nullable=True)  # Digital signature image


# ⭐ Anonymous Course Reviews ⭐

class ResenaCapacitacion(Base):
    __tablename__ = "resenas_capacitacion"
    id = Column(Integer, primary_key=True, index=True)
    programada_id = Column(Integer, ForeignKey('capacitaciones_programadas.id', ondelete="CASCADE"), nullable=False)
    estrellas = Column(Integer, nullable=False)  # 1-5
    comentario = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    # NO empleado_id → 100% anónimo

    programada = relationship("CapacitacionProgramada")
