# HDI Consultores — LMS de Capacitaciones

Sistema de capacitaciones (LMS) para HDI Consultores, cliente de eTrack. Desarrolladora: Mili (eTrack). Se mantiene con Claude Code / Claude Cowork (antes se usaba Antigravity).

## Stack y estructura

- `frontend/` — React + Vite. Deploy automático en **Vercel** (https://hdi-consultores.vercel.app) al pushear a `main`.
- `backend/` — FastAPI + SQLAlchemy + MySQL, auth JWT. Deploy automático en **Railway** (build por `backend/Dockerfile`, ver `railway.toml`).
- Migraciones de base de datos: Alembic (`python -m alembic upgrade head` en el shell de Railway). Detalle completo en `DEPLOY.md`.

## Dónde se generan los PDFs

- Certificado individual: `backend/app/api/endpoints/certificados.py` (reportlab, endpoint `/{codigo}/pdf`). Ojo: `drawCentredString` no soporta `\n`; para texto multilínea usar el helper `_draw_signature_block` / `_wrap_line`.
- Acta de capacitación y documentos del plan anual: `backend/app/api/endpoints/plan_anual.py` (reportlab Platypus, `Paragraph`).
- La firma del instructor es una imagen fija (firma + sello de Hernán Isotti): `backend/app/static/firma_instructor.png`. Se usa en certificado y acta; si el archivo falta, se cae a la firma cargada en el perfil del admin.

## Datos fijos que NO se inventan ni se abrevian

Matrículas del instructor (van completas en acta y certificado):

- Colegio Profesional de Seguridad e Higiene de la Provincia de Buenos Aires - LHS-004308 PBA
- COPIME - L002175 (CABA)

## Reglas de trabajo (Mili / eTrack)

- No inventar, deducir ni suponer datos. Ante un dato faltante, preguntarle a Mili.
- Textos de la app y de los PDFs en español (Argentina).
- El cliente pide mejoras chicas y frecuentes: hacer el cambio, contar qué se tocó, y commitear + pushear recién cuando Mili confirme.
- Deploy = `git push origin main`. No hay pasos manuales: Vercel (frontend) y Railway (backend) redeployan solos. Si el cambio toca la base de datos, hace falta migración Alembic en Railway.
- Commitear archivos puntuales (`git add <archivo>`), evitar `git add -A`: en el working tree puede haber churn de fin de línea (CRLF/LF) que muestra archivos como "modificados" sin cambios reales.

## Contexto del cliente

- HDI Consultores — consultora de Seguridad, Higiene y Medio Ambiente (www.hdiconsultores.com.ar). Titular: Hernán Isotti.
- Los empleados que se capacitan pertenecen a las empresas clientes de HDI. Portal admin en `/admin-login`; acceso de empleados desde el enlace en esa misma pantalla.

## Pendientes acordados con el cliente (reunión 06/07/2026)

- Visualización de la firma digital: debe recuperar siempre la última versión cargada por el empleado (verificar si ya quedó resuelto con los snapshots de firma).
- Sección de comentarios / retroalimentación para usuarios (hay reseñas anónimas implementadas; confirmar con el cliente si eso cubre el pedido).
