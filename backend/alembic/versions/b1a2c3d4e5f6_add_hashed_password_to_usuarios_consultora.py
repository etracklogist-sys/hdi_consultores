"""add hashed_password to usuarios_consultora

Revision ID: b1a2c3d4e5f6
Revises: 0a6aeae91440
Create Date: 2026-05-01 16:44:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'b1a2c3d4e5f6'
down_revision = '3abcdc8922ea'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Agregar columna hashed_password (nullable para no romper filas existentes)
    op.add_column(
        'usuarios_consultora',
        sa.Column('hashed_password', sa.String(255), nullable=True)
    )
    # Permitir uid_firebase nullable (antes era NOT NULL)
    op.alter_column(
        'usuarios_consultora',
        'uid_firebase',
        existing_type=sa.String(128),
        nullable=True
    )


def downgrade() -> None:
    op.drop_column('usuarios_consultora', 'hashed_password')
    op.alter_column(
        'usuarios_consultora',
        'uid_firebase',
        existing_type=sa.String(128),
        nullable=False
    )
