"""Add completion tracking and digital signatures

Revision ID: 3abcdc8922ea
Revises: 87f9242c213e
Create Date: 2026-04-13 16:05:59.692402

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3abcdc8922ea'
down_revision: Union[str, Sequence[str], None] = '87f9242c213e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # AsignacionCapacitacion — completion tracking
    with op.batch_alter_table('asignaciones_capacitacion', schema=None) as batch_op:
        batch_op.add_column(sa.Column('material_viewed_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('evaluation_started_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('evaluation_completed_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('evaluation_score', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('evaluation_passed', sa.Boolean(), nullable=True))
        batch_op.add_column(sa.Column('completed_at', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('completion_method', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('asistio', sa.Boolean(), nullable=True))

    # Empleado — digital signature
    with op.batch_alter_table('empleados', schema=None) as batch_op:
        batch_op.add_column(sa.Column('firma_base64', sa.Text(), nullable=True))

    # UsuarioConsultora — digital signature
    with op.batch_alter_table('usuarios_consultora', schema=None) as batch_op:
        batch_op.add_column(sa.Column('firma_base64', sa.Text(), nullable=True))

    # Certificado — signature snapshots
    with op.batch_alter_table('certificados', schema=None) as batch_op:
        batch_op.add_column(sa.Column('firma_empleado_snapshot', sa.Text(), nullable=True))
        batch_op.add_column(sa.Column('firma_capacitador_snapshot', sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('certificados', schema=None) as batch_op:
        batch_op.drop_column('firma_capacitador_snapshot')
        batch_op.drop_column('firma_empleado_snapshot')

    with op.batch_alter_table('usuarios_consultora', schema=None) as batch_op:
        batch_op.drop_column('firma_base64')

    with op.batch_alter_table('empleados', schema=None) as batch_op:
        batch_op.drop_column('firma_base64')

    with op.batch_alter_table('asignaciones_capacitacion', schema=None) as batch_op:
        batch_op.drop_column('asistio')
        batch_op.drop_column('completion_method')
        batch_op.drop_column('completed_at')
        batch_op.drop_column('evaluation_passed')
        batch_op.drop_column('evaluation_score')
        batch_op.drop_column('evaluation_completed_at')
        batch_op.drop_column('evaluation_started_at')
        batch_op.drop_column('material_viewed_at')

