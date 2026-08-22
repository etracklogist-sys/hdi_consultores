from app.core.config import settings
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.domain import Certificado
from app.core.security import require_admin
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import io
import os
import base64
import qrcode
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import landscape, letter
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase.pdfmetrics import stringWidth

router = APIRouter()

class CertificadoListResponse(BaseModel):
    id: int
    empleado_id: Optional[int] = None
    empleado_nombre: str
    empleado_dni: str
    cliente_nombre: str
    capacitacion_nombre: str
    hash_verificacion: str
    fecha_emision: Optional[datetime] = None
    fecha_vencimiento: Optional[datetime] = None
    estado: str

@router.get("/admin/list", response_model=List[CertificadoListResponse], dependencies=[Depends(require_admin)])
def listar_certificados(db: Session = Depends(get_db)):
    certificados = db.query(Certificado).all()
    res = []
    for c in certificados:
        res.append({
            "id": c.id,
            "empleado_id": c.empleado_id,
            "empleado_nombre": c.empleado.nombre_completo if c.empleado and c.empleado.nombre_completo else "N/A",
            "empleado_dni": c.empleado.dni if c.empleado and c.empleado.dni else "N/A",
            "cliente_nombre": c.cliente.razon_social if c.cliente and c.cliente.razon_social else "N/A",
            "capacitacion_nombre": c.capacitacion.nombre if c.capacitacion and c.capacitacion.nombre else "N/A",
            "hash_verificacion": c.hash_verificacion or "",
            "fecha_emision": c.fecha_emision,
            "fecha_vencimiento": c.fecha_vencimiento,
            "estado": c.estado or "VIGENTE"
        })
    return res


@router.get("/verificar/{codigo}")
def verificar_certificado(codigo: str, db: Session = Depends(get_db)):
    c = db.query(Certificado).filter(Certificado.hash_verificacion == codigo).first()
    if not c:
        raise HTTPException(status_code=404, detail="Certificado inválido o no existe")
        
    return {
        "valido": c.estado == "VIGENTE",
        "empleado": c.empleado.nombre_completo if c.empleado else "N/A",
        "dni": c.empleado.dni if c.empleado else "N/A",
        "entrenamiento": c.capacitacion.nombre if c.capacitacion else "N/A",
        "cliente": c.cliente.razon_social if c.cliente else "N/A",
        "fecha_emision": c.fecha_emision,
        "fecha_vencimiento": c.fecha_vencimiento,
        "estado": c.estado,
        "hash_verificacion": c.hash_verificacion
    }


def _wrap_line(text, font_name, font_size, max_width):
    """Split one line of text into as many lines as needed so that each
    rendered line fits within max_width points."""
    words = text.split()
    if not words:
        return []
    lines = []
    current = words[0]
    for word in words[1:]:
        candidate = current + " " + word
        if stringWidth(candidate, font_name, font_size) <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def _draw_signature_block(c_pdf, sig_base64, label, name, block_x, block_y, block_w, block_h, name_size=8):
    """Draw a signature block with fixed dimensions. Signature image is constrained
    inside the block, with label and name text BELOW the signature line.

    Layout (top to bottom within block):
      - Signature image area (constrained)
      - Horizontal line
      - Label text
      - Name text (supports "\\n" for multiple lines; long lines auto-wrap
        to the block width so they never overflow the page)
    """
    # Fixed dimensions inside the block
    sig_area_h = block_h - 40  # Reserve 40pt for text below
    sig_max_w = block_w - 20   # 10pt padding each side
    sig_max_h = sig_area_h - 10  # 10pt padding above line
    
    line_y = block_y + 40  # Line sits 40pt from block bottom (above text)
    
    # Draw signature image if present
    if sig_base64:
        try:
            raw = sig_base64.split(",")[-1] if "," in sig_base64 else sig_base64
            sig_data = base64.b64decode(raw)
            sig_io = io.BytesIO(sig_data)
            sig_img = ImageReader(sig_io)
            
            # Calculate constrained size preserving aspect ratio
            img_w, img_h = sig_img.getSize()
            scale = min(sig_max_w / img_w, sig_max_h / img_h, 1.0)
            draw_w = img_w * scale
            draw_h = img_h * scale
            
            # Center horizontally, sit just above the line
            draw_x = block_x + (block_w - draw_w) / 2
            draw_y = line_y + 4  # 4pt gap above line
            
            c_pdf.drawImage(sig_img, draw_x, draw_y, width=draw_w, height=draw_h,
                           preserveAspectRatio=True, mask='auto')
        except Exception:
            pass
    
    # Draw signature line
    c_pdf.setStrokeColorRGB(0.4, 0.4, 0.4)
    c_pdf.setLineWidth(0.75)
    c_pdf.line(block_x + 10, line_y, block_x + block_w - 10, line_y)
    
    # Draw label text (below line)
    c_pdf.setFillColorRGB(0, 0, 0)
    c_pdf.setFont("Helvetica-Bold", 9)
    center_x = block_x + block_w / 2
    c_pdf.drawCentredString(center_x, line_y - 14, label)
    
    # Draw name text (below label), one centred line at a time
    c_pdf.setFont("Helvetica", name_size)
    c_pdf.setFillColorRGB(0.3, 0.3, 0.3)
    name_lines = []
    for raw_line in (name or "").split("\n"):
        name_lines.extend(_wrap_line(raw_line, "Helvetica", name_size, block_w - 8))
    text_y = line_y - 26
    for text_line in name_lines:
        c_pdf.drawCentredString(center_x, text_y, text_line)
        text_y -= name_size + 2
    c_pdf.setFillColorRGB(0, 0, 0)



@router.post("/admin/backfill-firmas")
def backfill_firma_snapshots(db: Session = Depends(get_db)):
    """One-time migration: backfill firma_empleado_snapshot and
    firma_capacitador_snapshot on certificates that are missing them."""
    from app.models.domain import UsuarioConsultora
    
    # Get admin signature for trainer fallback
    admin_user = db.query(UsuarioConsultora).filter(UsuarioConsultora.firma_base64 != None).first()
    firma_cap = admin_user.firma_base64 if admin_user else None
    
    certs = db.query(Certificado).all()
    updated = 0
    for cert in certs:
        changed = False
        # Backfill employee signature
        if not cert.firma_empleado_snapshot and cert.empleado and cert.empleado.firma_base64:
            cert.firma_empleado_snapshot = cert.empleado.firma_base64
            changed = True
        # Backfill trainer/consultant signature
        if not cert.firma_capacitador_snapshot and firma_cap:
            cert.firma_capacitador_snapshot = firma_cap
            changed = True
        if changed:
            updated += 1
    
    db.commit()
    return {"message": f"Backfill completed. Updated {updated} certificates out of {len(certs)} total."}


@router.get("/{codigo}/pdf")
def descargar_pdf_certificado(codigo: str, db: Session = Depends(get_db)):
    c = db.query(Certificado).filter(Certificado.hash_verificacion == codigo).first()
    if not c:
        raise HTTPException(status_code=404, detail="Certificado no encontrado")
        
    buffer = io.BytesIO()
    
    # Landscape letter: 792 x 612 points
    c_pdf = canvas.Canvas(buffer, pagesize=landscape(letter))
    width, height = landscape(letter)
    
    # ── COLOR PALETTE ──
    BLUE_DARK = (0.06, 0.20, 0.38)    # #0f3460
    BLUE_MID = (0.10, 0.34, 0.66)     # #1a56a8
    BLUE_ACCENT = (0.23, 0.51, 0.96)  # #3b82f6
    GOLD = (0.80, 0.68, 0.36)         # #ccad5c
    
    # ── HDI Logo ──
    import os as _os
    logo_path = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..', '..', 'static', 'logo_hdi.jpg')
    
    # ══════════════════════════════════════════
    # DECORATIVE FRAME: Double border
    # ══════════════════════════════════════════
    # Outer border
    c_pdf.setStrokeColor(colors.HexColor('#0f3460'))
    c_pdf.setLineWidth(3)
    c_pdf.rect(15, 15, width - 30, height - 30, fill=0, stroke=1)
    
    # Inner border (gold accent)
    c_pdf.setStrokeColor(colors.HexColor('#ccad5c'))
    c_pdf.setLineWidth(1)
    c_pdf.rect(22, 22, width - 44, height - 44, fill=0, stroke=1)
    
    # ══════════════════════════════════════════
    # HEADER BANNER: Dark blue with gold accent
    # ══════════════════════════════════════════
    banner_h = 75
    banner_y = height - 30 - banner_h
    
    # Main banner
    c_pdf.setFillColorRGB(*BLUE_DARK)
    c_pdf.rect(22, banner_y, width - 44, banner_h, fill=1, stroke=0)
    
    # Gold accent stripe at bottom of banner
    c_pdf.setFillColorRGB(*GOLD)
    c_pdf.rect(22, banner_y, width - 44, 3, fill=1, stroke=0)
    
    # Logo on banner (left side, white bg area)
    if _os.path.exists(logo_path):
        try:
            logo_img = ImageReader(logo_path)
            # Small white rectangle behind logo
            c_pdf.setFillColor(colors.white)
            c_pdf.roundRect(30, banner_y + 8, 80, banner_h - 16, 4, fill=1, stroke=0)
            c_pdf.drawImage(logo_img, 34, banner_y + 12, width=72, height=banner_h - 24, preserveAspectRatio=True, mask='auto')
        except:
            pass
    
    # Title text on banner
    c_pdf.setFillColor(colors.white)
    c_pdf.setFont("Helvetica-Bold", 32)
    title_x = (width + 80) / 2.0 if _os.path.exists(logo_path) else width / 2.0
    c_pdf.drawCentredString(title_x, banner_y + 30, "CERTIFICADO DE CAPACITACI\u00d3N")
    
    # ══════════════════════════════════════════
    # BODY CONTENT
    # ══════════════════════════════════════════
    c_pdf.setFillColor(colors.black)
    
    body_top = banner_y - 30
    
    c_pdf.setFont("Helvetica", 13)
    c_pdf.setFillColorRGB(0.3, 0.3, 0.3)
    c_pdf.drawCentredString(width / 2.0, body_top, "Este documento certifica que")
    
    # Employee name - large and bold
    c_pdf.setFillColor(colors.black)
    c_pdf.setFont("Helvetica-Bold", 28)
    emp_name = c.empleado.nombre_completo.upper() if c.empleado else "N/A"
    c_pdf.drawCentredString(width / 2.0, body_top - 42, emp_name)
    
    # Gold decorative line under name
    line_w = min(len(emp_name) * 14, 400)
    line_x = (width - line_w) / 2
    c_pdf.setStrokeColorRGB(*GOLD)
    c_pdf.setLineWidth(1.5)
    c_pdf.line(line_x, body_top - 52, line_x + line_w, body_top - 52)
    
    # DNI & Company
    c_pdf.setFont("Helvetica", 11)
    c_pdf.setFillColorRGB(0.3, 0.3, 0.3)
    c_pdf.drawCentredString(width / 2.0, body_top - 72, f"DNI: {c.empleado.dni if c.empleado else 'N/A'}  \u2022  Empresa: {c.cliente.razon_social if c.cliente else 'N/A'}")
    
    c_pdf.setFont("Helvetica", 13)
    c_pdf.drawCentredString(width / 2.0, body_top - 102, "ha completado satisfactoriamente el entrenamiento de:")
    
    # Course name - prominent
    c_pdf.setFont("Helvetica-Bold", 22)
    c_pdf.setFillColorRGB(*BLUE_MID)
    c_pdf.drawCentredString(width / 2.0, body_top - 140, c.capacitacion.nombre.upper() if c.capacitacion else "N/A")
    
    c_pdf.setFillColor(colors.black)
    
    # Approval method
    if c.intento_id:
        resultado_txt = "Aprobado por calificaci\u00f3n de evaluaci\u00f3n"
    else:
        resultado_txt = "Cumpli\u00f3 con los registros de asistencia"

    c_pdf.setFont("Helvetica-Oblique", 11)
    c_pdf.setFillColorRGB(0.35, 0.35, 0.35)
    c_pdf.drawCentredString(width / 2.0, body_top - 172, f"Mecanismo de aprobaci\u00f3n: {resultado_txt}")
    
    # Dates
    c_pdf.setFont("Helvetica", 10)
    emision = c.fecha_emision.strftime('%d/%m/%Y')
    vence = c.fecha_vencimiento.strftime('%d/%m/%Y')
    c_pdf.drawCentredString(width / 2.0, body_top - 198, f"Fecha de Emisi\u00f3n: {emision}  |  Vigente hasta: {vence}")
    
    # ══════════════════════════════════════════
    # BOTTOM SECTION: QR + Signatures
    # ══════════════════════════════════════════
    
    # Thin separator line
    c_pdf.setStrokeColorRGB(0.85, 0.85, 0.85)
    c_pdf.setLineWidth(0.5)
    c_pdf.line(40, 195, width - 40, 195)
    
    # ── QR Code ──
    VERIF_X = 40
    VERIF_Y = 105
    QR_SIZE = 75
    
    qr_data = f"{settings.FRONTEND_URL}/verificar/{c.hash_verificacion}"
    qr = qrcode.make(qr_data)
    qr_io = io.BytesIO()
    qr.save(qr_io, format="PNG")
    qr_io.seek(0)
    qr_img = ImageReader(qr_io)
    c_pdf.drawImage(qr_img, VERIF_X, VERIF_Y, width=QR_SIZE, height=QR_SIZE)
    
    # Verification text
    text_x = VERIF_X + QR_SIZE + 10
    c_pdf.setFont("Helvetica-Bold", 7)
    c_pdf.setFillColorRGB(0.25, 0.25, 0.25)
    c_pdf.drawString(text_x, VERIF_Y + QR_SIZE - 10, "VERIFICACI\u00d3N DIGITAL")
    c_pdf.setFont("Helvetica", 6)
    c_pdf.setFillColorRGB(0.4, 0.4, 0.4)
    c_pdf.drawString(text_x, VERIF_Y + QR_SIZE - 20, "C\u00f3digo SHA-256:")
    
    hash_str = c.hash_verificacion or ""
    if len(hash_str) > 36:
        c_pdf.drawString(text_x, VERIF_Y + QR_SIZE - 30, hash_str[:36])
        c_pdf.drawString(text_x, VERIF_Y + QR_SIZE - 39, hash_str[36:])
        c_pdf.drawString(text_x, VERIF_Y + QR_SIZE - 52, "Escanee el QR o visite el portal")
        c_pdf.drawString(text_x, VERIF_Y + QR_SIZE - 61, "web para verificar vigencia.")
    else:
        c_pdf.drawString(text_x, VERIF_Y + QR_SIZE - 30, hash_str)
        c_pdf.drawString(text_x, VERIF_Y + QR_SIZE - 44, "Escanee el QR o visite el portal")
        c_pdf.drawString(text_x, VERIF_Y + QR_SIZE - 53, "web para verificar vigencia.")
    
    c_pdf.setFillColor(colors.black)
    
    # ── SIGNATURE BLOCKS ──
    SIG_BLOCK_W = 185
    SIG_BLOCK_H = 80
    SIG_BLOCK_Y = 100
    SIG_GAP = 30
    
    emp_block_x = width - (SIG_BLOCK_W * 2) - SIG_GAP - 40
    trainer_block_x = emp_block_x + SIG_BLOCK_W + SIG_GAP
    
    # Fallback to current signatures if snapshot is empty
    sig_empleado = c.firma_empleado_snapshot
    if not sig_empleado and c.empleado and c.empleado.firma_base64:
        sig_empleado = c.empleado.firma_base64
        
    # Firma del instructor: imagen oficial fija (firma + sello de Hernán Isotti)
    # incluida en la app. Si el archivo falta, se usa el comportamiento anterior
    # (snapshot del certificado / firma cargada por el admin).
    sig_capacitador = None
    firma_instructor_path = _os.path.join(_os.path.dirname(_os.path.abspath(__file__)), '..', '..', 'static', 'firma_instructor.png')
    if _os.path.exists(firma_instructor_path):
        try:
            with open(firma_instructor_path, 'rb') as _f:
                sig_capacitador = base64.b64encode(_f.read()).decode()
        except Exception:
            sig_capacitador = None
    if not sig_capacitador:
        sig_capacitador = c.firma_capacitador_snapshot
    if not sig_capacitador:
        from app.models.domain import UsuarioConsultora
        admin_user = db.query(UsuarioConsultora).filter(UsuarioConsultora.firma_base64 != None).first()
        if admin_user:
            sig_capacitador = admin_user.firma_base64

    _draw_signature_block(
        c_pdf,
        sig_base64=sig_empleado,
        label="Firma del Empleado",
        name=c.empleado.nombre_completo if c.empleado else "N/A",
        block_x=emp_block_x,
        block_y=SIG_BLOCK_Y,
        block_w=SIG_BLOCK_W,
        block_h=SIG_BLOCK_H
    )
    
    _draw_signature_block(
        c_pdf,
        sig_base64=sig_capacitador,
        label="Firma del Instructor / Representante",
        name="HDI Consultores\n"
             "Colegio Profesional de Seguridad e Higiene de la Provincia de Buenos Aires - LHS-004308 PBA\n"
             "COPIME - L002175",
        block_x=trainer_block_x,
        block_y=SIG_BLOCK_Y,
        block_w=SIG_BLOCK_W,
        block_h=SIG_BLOCK_H + 15,  # más alto para que la firma con sello se vea bien
        name_size=7
    )
    
    c_pdf.showPage()
    c_pdf.save()
    
    buffer.seek(0)
    headers = {
        'Content-Disposition': f'inline; filename="Certificado_{c.empleado.dni}_{emision}.pdf"'
    }
    return Response(buffer.getvalue(), headers=headers, media_type='application/pdf')
