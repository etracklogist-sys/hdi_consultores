"""Add missing asignacion_id to evaluacion and intentos

Revision ID: 87f9242c213e
Revises: 7e1cd32ecb94
Create Date: 2026-04-03 19:43:29.161588

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '87f9242c213e'
down_revision: Union[str, Sequence[str], None] = '7e1cd32ecb94'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('evaluaciones', schema=None) as batch_op:
        batch_op.add_column(sa.Column('asignacion_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_evaluaciones_asig', 'asignaciones_capacitacion', ['asignacion_id'], ['id'])

    with op.batch_alter_table('intentos', schema=None) as batch_op:
        batch_op.add_column(sa.Column('asignacion_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_intentos_asig', 'asignaciones_capacitacion', ['asignacion_id'], ['id'])

    with op.batch_alter_table('certificados', schema=None) as batch_op:
        # Check if already added in some weird sqlite branch, but for fresh install it doesn't exist
        batch_op.add_column(sa.Column('asignacion_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_certificados_asig', 'asignaciones_capacitacion', ['asignacion_id'], ['id'], ondelete='CASCADE')

def downgrade() -> None:
    with op.batch_alter_table('certificados', schema=None) as batch_op:
        batch_op.drop_constraint('fk_certificados_asig', type_='foreignkey')
        batch_op.drop_column('asignacion_id')

    with op.batch_alter_table('intentos', schema=None) as batch_op:
        batch_op.drop_constraint('fk_intentos_asig', type_='foreignkey')
        batch_op.drop_column('asignacion_id')

    with op.batch_alter_table('evaluaciones', schema=None) as batch_op:
        batch_op.drop_constraint('fk_evaluaciones_asig', type_='foreignkey')
        batch_op.drop_column('asignacion_id')
