"""add_plan_anual_y_programadas

Revision ID: 0a6aeae91440
Revises: 9c016b5c72f3
Create Date: 2026-04-01 15:39:26.486142

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.orm import Session
from datetime import datetime, timezone

# revision identifiers, used by Alembic.
revision: str = '0a6aeae91440'
down_revision: Union[str, Sequence[str], None] = '9c016b5c72f3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. CREATE NEW TABLES
    op.create_table('planes_anuales_cliente',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('cliente_id', sa.Integer(), nullable=False),
        sa.Column('anio', sa.Integer(), nullable=False),
        sa.Column('estado', sa.String(length=50), nullable=True),
        sa.Column('observaciones', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['cliente_id'], ['clientes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('cliente_id', 'anio', name='uix_cliente_anio_plan')
    )
    op.create_index(op.f('ix_planes_anuales_cliente_id'), 'planes_anuales_cliente', ['id'], unique=False)

    op.create_table('plan_anual_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('plan_anual_id', sa.Integer(), nullable=False),
        sa.Column('capacitacion_id', sa.Integer(), nullable=False),
        sa.Column('mes', sa.Integer(), nullable=False),
        sa.Column('tipo', sa.String(length=50), nullable=False),
        sa.Column('modalidad_override', sa.String(length=50), nullable=True),
        sa.Column('requiere_evaluacion_override', sa.Boolean(), nullable=True),
        sa.Column('activo', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['capacitacion_id'], ['catalogo_capacitaciones.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['plan_anual_id'], ['planes_anuales_cliente.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_plan_anual_items_id'), 'plan_anual_items', ['id'], unique=False)

    op.create_table('capacitaciones_programadas',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('cliente_id', sa.Integer(), nullable=False),
        sa.Column('capacitacion_id', sa.Integer(), nullable=False),
        sa.Column('plan_item_id', sa.Integer(), nullable=True),
        sa.Column('mes', sa.Integer(), nullable=False),
        sa.Column('anio', sa.Integer(), nullable=False),
        sa.Column('fecha_activacion', sa.DateTime(), nullable=True),
        sa.Column('fecha_cierre', sa.DateTime(), nullable=True),
        sa.Column('tipo', sa.String(length=50), nullable=False),
        sa.Column('modalidad_final', sa.String(length=50), nullable=False),
        sa.Column('requiere_evaluacion_final', sa.Boolean(), nullable=False),
        sa.Column('estado', sa.String(length=50), nullable=True),
        sa.Column('generada_automaticamente', sa.Boolean(), nullable=True),
        sa.Column('alcance_asignacion', sa.String(length=50), nullable=True),
        sa.Column('empleados_incluidos', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['capacitacion_id'], ['catalogo_capacitaciones.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['cliente_id'], ['clientes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['plan_item_id'], ['plan_anual_items.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('cliente_id', 'capacitacion_id', 'mes', 'anio', 'tipo', name='uix_programada_idempotency')
    )
    op.create_index(op.f('ix_capacitaciones_programadas_id'), 'capacitaciones_programadas', ['id'], unique=False)

    # 2. ADD COLUMN AS NULLABLE TO AVOID ERROR
    with op.batch_alter_table('asignaciones_capacitacion', schema=None) as batch_op:
        batch_op.add_column(sa.Column('programada_id', sa.Integer(), nullable=True))
    # 3. LEGACY DATA MIGRATION LOGIC
    # Removed for MySQL fresh install
    
    # 4. ENFORCE CONSTRAINTS AND NOT NULL
    with op.batch_alter_table('asignaciones_capacitacion', schema=None) as batch_op:
        # batch_op.drop_constraint('uix_empleado_capacitacion_asignacion', type_='unique')
        batch_op.create_unique_constraint('uix_empleado_programada_asignacion', ['empleado_id', 'programada_id'])
        batch_op.alter_column('programada_id', existing_type=sa.Integer(), nullable=False)


def downgrade() -> None:
    with op.batch_alter_table('asignaciones_capacitacion', schema=None) as batch_op:
        batch_op.drop_constraint('uix_empleado_programada_asignacion', type_='unique')
        batch_op.create_unique_constraint('uix_empleado_capacitacion_asignacion', ['empleado_id', 'capacitacion_id'])
        batch_op.drop_column('programada_id')

    op.drop_index(op.f('ix_capacitaciones_programadas_id'), table_name='capacitaciones_programadas')
    op.drop_table('capacitaciones_programadas')
    op.drop_index(op.f('ix_plan_anual_items_id'), table_name='plan_anual_items')
    op.drop_table('plan_anual_items')
    op.drop_index(op.f('ix_planes_anuales_cliente_id'), table_name='planes_anuales_cliente')
    op.drop_table('planes_anuales_cliente')
