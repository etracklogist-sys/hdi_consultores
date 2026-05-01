"""upgrade_certificado_model

Revision ID: 9c016b5c72f3
Revises: c98ec02d5c1e
Create Date: 2026-03-26 19:59:35.388354

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9c016b5c72f3'
down_revision: Union[str, Sequence[str], None] = 'c98ec02d5c1e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    with op.batch_alter_table('certificados', schema=None) as batch_op:
        batch_op.add_column(sa.Column('sesion_participante_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('cliente_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('capacitacion_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('estado', sa.String(length=50), nullable=True, server_default='VIGENTE'))
        batch_op.add_column(sa.Column('archivo_url', sa.String(length=1024), nullable=True))
        batch_op.create_unique_constraint('uix_certificado_participacion', ['sesion_participante_id'])
        batch_op.create_foreign_key(batch_op.f('fk_certificados_capacitacion_id_catalogo_capacitaciones'), 'catalogo_capacitaciones', ['capacitacion_id'], ['id'], ondelete='CASCADE')
        batch_op.create_foreign_key(batch_op.f('fk_certificados_sesion_participante_id_sesion_participantes'), 'sesion_participantes', ['sesion_participante_id'], ['id'], ondelete='CASCADE')
        batch_op.create_foreign_key(batch_op.f('fk_certificados_cliente_id_clientes'), 'clientes', ['cliente_id'], ['id'], ondelete='CASCADE')

    # with op.batch_alter_table('sesion_participantes', schema=None) as batch_op:
    #     batch_op.add_column(sa.Column('asignacion_id', sa.Integer(), nullable=True))
    #     batch_op.add_column(sa.Column('estado_participacion', sa.String(length=50), nullable=True))
    #     batch_op.add_column(sa.Column('nota', sa.Float(), nullable=True))
    #     batch_op.add_column(sa.Column('aprobado', sa.Boolean(), nullable=True))
    #     batch_op.add_column(sa.Column('observaciones', sa.Text(), nullable=True))
    #     batch_op.add_column(sa.Column('fecha_registro', sa.DateTime(), nullable=True))
    #     batch_op.create_foreign_key(batch_op.f('fk_sesion_participantes_asignacion_id_asignaciones_capacitacion'), 'asignaciones_capacitacion', ['asignacion_id'], ['id'], ondelete='SET NULL')

def downgrade() -> None:
    """Downgrade schema."""
    pass
