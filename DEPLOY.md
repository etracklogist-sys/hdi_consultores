# Guía de Despliegue — HDI Consultores LMS

> Stack actual: **React (Vite) + FastAPI + MySQL + JWT puro** (sin Firebase).

## Arquitectura

```
Frontend SPA  →  Netlify / Vercel (gratis, CDN global)
Backend API   →  Railway / Render / Cloud Run
Base de datos →  Railway MySQL / Cloud SQL
```

## Stack rápido recomendado para ~200 empleados

| Componente | Servicio | Costo |
|-----------|----------|-------|
| Frontend | Netlify Free | $0/mes |
| Backend | Railway Starter | ~$5/mes |
| MySQL | Railway MySQL | ~$5/mes |
| **Total** | | **~$10/mes** |

---

## 1. Backend (Railway)

### Variables de entorno obligatorias

```
DATABASE_URL   = mysql+pymysql://user:pass@host:3306/hdi_lms
SECRET_KEY     = <generar con: python -c "import secrets; print(secrets.token_hex(32))">
BACKEND_CORS_ORIGINS = ["https://tu-frontend.netlify.app"]
ENV            = production
```

### Pasos

1. railway.app → New Project → **Add MySQL** → copiar DATABASE_URL
2. New Service → GitHub Repo → root: `backend/`
3. Agregar las variables de entorno
4. Deploy automático desde el Dockerfile incluido
5. En Railway Shell ejecutar:
   ```bash
   python -m alembic upgrade head
   python seed_admin.py
   ```

---

## 2. Frontend (Netlify)

1. app.netlify.com → Add site → GitHub
2. Base directory: `frontend` | Build: `npm run build` | Publish: `dist`
3. Variables de entorno: `VITE_API_URL = https://tu-backend.up.railway.app/api/v1`
4. El archivo `public/_redirects` ya está incluido (necesario para SPA routing)

---

## 3. Alternativas

- **Render**: Web Service (backend) + PostgreSQL — cambiar pymysql por psycopg2-binary
- **Cloud Run**: `gcloud run deploy hdi-backend --source . --platform managed --region us-central1`
- **Vercel**: `vercel.json` ya incluido en el frontend

---

## 4. Checklist de seguridad

- [ ] SECRET_KEY generada aleatoriamente (nunca usar el valor de desarrollo)
- [ ] BACKEND_CORS_ORIGINS apunta solo al dominio exacto del frontend
- [ ] Cambiar contraseña del admin tras el primer login
- [ ] DATABASE_URL usa usuario con permisos mínimos (no root)

---

## 5. Migraciones

```bash
python -m alembic current          # ver estado
python -m alembic upgrade head     # aplicar migraciones
python seed_admin.py               # crear usuario admin inicial

# Si hay múltiples heads:
python -m alembic merge heads -m "merge_prod"
python -m alembic upgrade head
```

---

## 6. Verificación post-deploy

```bash
# Health check
curl https://tu-backend.up.railway.app/

# Login admin
curl -X POST https://tu-backend.up.railway.app/api/v1/auth/admin-login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hdiconsultores.com","password":"TuPassword"}'
```
