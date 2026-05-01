# HDI Consultores - Backend

## Entorno Local (Desarrollo)

El backend corre sobre FastAPI + SQLAlchemy usando una base de datos SQLite (`hdi_local.db`).

### Ejecución
Para iniciar el servidor local en modo recarga:
```bash
python -m uvicorn app.main:app --reload
```

## Migraciones de Base de Datos (Alembic)

Las tablas ya no se autogeneran de forma frágil (`Base.metadata.create_all`). Toda la estructura de la base de datos se gestiona estrictamente vía **Alembic**.

### Comandos de Migración

**Generar una nueva migración (luego de editar `models/domain.py`):**
```bash
python -m alembic revision --autogenerate -m "Descripción de tu cambio en los modelos"
```

**Aplicar las migraciones (Impactar `hdi_local.db` con los cambios):**
```bash
python -m alembic upgrade head
```

> **NOTA IMPORTANTE PARA SQLITE**:
> Alembic está configurado nativamente con `render_as_batch=True` en `env.py` para soportar acciones de modificación profunda (renombrar o eliminar columnas complejas) en SQLite que ordinariamente lanzarían errores.
