"""Add missing domain columns

Revision ID: 7e1cd32ecb94
Revises: e25f784b6c04
Create Date: 2026-04-03 19:40:53.841355

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7e1cd32ecb94'
down_revision: Union[str, Sequence[str], None] = 'e25f784b6c04'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('cliente_areas',
        sa.Column('cliente_id', sa.Integer(), nullable=False),
        sa.Column('area_id', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['area_id'], ['areas.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['cliente_id'], ['clientes.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('cliente_id', 'area_id')
    )

    with op.batch_alter_table('areas', schema=None) as batch_op:
        batch_op.add_column(sa.Column('activo', sa.Boolean(), nullable=True, server_default='1'))

    with op.batch_alter_table('rubros', schema=None) as batch_op:
        batch_op.add_column(sa.Column('activo', sa.Boolean(), nullable=True, server_default='1'))

    with op.batch_alter_table('catalogo_capacitaciones', schema=None) as batch_op:
        batch_op.add_column(sa.Column('modalidad', sa.String(length=50), nullable=True))
        batch_op.add_column(sa.Column('puntaje_total', sa.Float(), nullable=True))
        batch_op.add_column(sa.Column('rubro_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('area_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_cat_cap_rubro', 'rubros', ['rubro_id'], ['id'], ondelete='SET NULL')
        batch_op.create_foreign_key('fk_cat_cap_area', 'areas', ['area_id'], ['id'], ondelete='SET NULL')

    with op.batch_alter_table('asignaciones_capacitacion', schema=None) as batch_op:
        batch_op.add_column(sa.Column('cliente_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key('fk_asig_cap_cliente', 'clientes', ['cliente_id'], ['id'], ondelete='CASCADE')


def downgrade() -> None:
    with op.batch_alter_table('asignaciones_capacitacion', schema=None) as batch_op:
        batch_op.drop_constraint('fk_asig_cap_cliente', type_='foreignkey')
        batch_op.drop_column('cliente_id')

    with op.batch_alter_table('catalogo_capacitaciones', schema=None) as batch_op:
        batch_op.drop_constraint('fk_cat_cap_area', type_='foreignkey')
        batch_op.drop_constraint('fk_cat_cap_rubro', type_='foreignkey')
        batch_op.drop_column('area_id')
        batch_op.drop_column('rubro_id')
        batch_op.drop_column('puntaje_total')
        batch_op.drop_column('modalidad')

    with op.batch_alter_table('rubros', schema=None) as batch_op:
        batch_op.drop_column('activo')

    with op.batch_alter_table('areas', schema=None) as batch_op:
        batch_op.drop_column('activo')

    op.drop_table('cliente_areas')
