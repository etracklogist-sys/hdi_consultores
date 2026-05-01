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


def _draw_signature_block(c_pdf, sig_base64, label, name, block_x, block_y, block_w, block_h):
    """Draw a signature block with fixed dimensions. Signature image is constrained
    inside the block, with label and name text BELOW the signature line.
    
    Layout (top to bottom within block):
      - Signature image area (constrained)
      - Horizontal line
      - Label text
      - Name text
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
    
    # Draw name text (below label)
    c_pdf.setFont("Helvetica", 8)
    c_pdf.setFillColorRGB(0.3, 0.3, 0.3)
    c_pdf.drawCentredString(center_x, line_y - 26, name)
    c_pdf.setFillColorRGB(0, 0, 0)


@router.get("/{codigo}/pdf")
def descargar_pdf_certificado(codigo: str, db: Session = Depends(get_db)):
    c = db.query(Certificado).filter(Certificado.hash_verificacion == codigo).first()
    if not c:
        raise HTTPException(status_code=404, detail="Certificado no encontrado")
        
    buffer = io.BytesIO()
    
    # Landscape letter: 792 x 612 points
    c_pdf = canvas.Canvas(buffer, pagesize=landscape(letter))
    width, height = landscape(letter)
    
    # ═══════════════════════════════════════════
    # ZONE 1: Header Banner (top 80pt)
    # ═══════════════════════════════════════════
    c_pdf.setFillColorRGB(0.1, 0.4, 0.8)
    c_pdf.rect(0, height - 80, width, 80, fill=1, stroke=0)
    
    c_pdf.setFillColorRGB(1, 1, 1)
    c_pdf.setFont("Helvetica-Bold", 36)
    c_pdf.drawCentredString(width / 2.0, height - 55, "CERTIFICADO DE CAPACITACIÓN")
    
    # ═══════════════════════════════════════════
    # ZONE 2: Body Content (y=530 to y=260)
    # ═══════════════════════════════════════════
    c_pdf.setFillColorRGB(0, 0, 0)
    c_pdf.setFont("Helvetica", 14)
    c_pdf.drawCentredString(width / 2.0, height - 120, "Este documento certifica que")
    
    c_pdf.setFont("Helvetica-Bold", 28)
    c_pdf.drawCentredString(width / 2.0, height - 160, c.empleado.nombre_completo.upper() if c.empleado else "N/A")
    
    c_pdf.setFont("Helvetica", 12)
    c_pdf.drawCentredString(width / 2.0, height - 190, f"DNI: {c.empleado.dni if c.empleado else 'N/A'} - Empresa: {c.cliente.razon_social if c.cliente else 'N/A'}")
    
    c_pdf.setFont("Helvetica", 14)
    c_pdf.drawCentredString(width / 2.0, height - 230, "ha completado satisfactoriamente el entrenamiento de:")
    
    c_pdf.setFont("Helvetica-Bold", 22)
    c_pdf.drawCentredString(width / 2.0, height - 270, c.capacitacion.nombre.upper() if c.capacitacion else "N/A")
    
    # Approval method
    if c.intento_id:
        resultado_txt = "Aprobado por calificación de evaluación"
    else:
        resultado_txt = "Cumplió con los registros de asistencia"

    c_pdf.setFont("Helvetica-Oblique", 12)
    c_pdf.drawCentredString(width / 2.0, height - 300, f"Mecanismo de aprobación: {resultado_txt}")
    
    # Dates
    c_pdf.setFont("Helvetica", 11)
    emision = c.fecha_emision.strftime('%d/%m/%Y')
    vence = c.fecha_vencimiento.strftime('%d/%m/%Y')
    c_pdf.drawCentredString(width / 2.0, height - 340, f"Fecha de Emisión: {emision} | Vigente hasta: {vence}")
    
    # ═══════════════════════════════════════════
    # ZONE 3: Verification Block (bottom-left)
    # Fixed area: x=30, y=100, w=220, h=120
    # Contains QR + verification text
    # ═══════════════════════════════════════════
    VERIF_X = 30
    VERIF_Y = 100
    QR_SIZE = 90
    
    qr_data = f"https://planavi.app/verificar/{c.hash_verificacion}"
    qr = qrcode.make(qr_data)
    qr_io = io.BytesIO()
    qr.save(qr_io, format="PNG")
    qr_io.seek(0)
    qr_img = ImageReader(qr_io)
    c_pdf.drawImage(qr_img, VERIF_X, VERIF_Y, width=QR_SIZE, height=QR_SIZE)
    
    # Verification text (right of QR)
    text_x = VERIF_X + QR_SIZE + 12
    c_pdf.setFont("Helvetica-Bold", 7.5)
    c_pdf.setFillColorRGB(0.2, 0.2, 0.2)
    c_pdf.drawString(text_x, VERIF_Y + QR_SIZE - 12, "VERIFICACIÓN DIGITAL")
    c_pdf.setFont("Helvetica", 6.5)
    c_pdf.drawString(text_x, VERIF_Y + QR_SIZE - 24, "Código de validación SHA-256:")
    
    # Split long hash across lines if needed
    hash_str = c.hash_verificacion or ""
    if len(hash_str) > 40:
        c_pdf.drawString(text_x, VERIF_Y + QR_SIZE - 35, hash_str[:40])
        c_pdf.drawString(text_x, VERIF_Y + QR_SIZE - 45, hash_str[40:])
        c_pdf.drawString(text_x, VERIF_Y + QR_SIZE - 58, "Escanee el QR o visite el portal")
        c_pdf.drawString(text_x, VERIF_Y + QR_SIZE - 68, "web para verificar vigencia.")
    else:
        c_pdf.drawString(text_x, VERIF_Y + QR_SIZE - 35, hash_str)
        c_pdf.drawString(text_x, VERIF_Y + QR_SIZE - 50, "Escanee el QR o visite el portal")
        c_pdf.drawString(text_x, VERIF_Y + QR_SIZE - 60, "web para verificar vigencia.")
    
    c_pdf.setFillColorRGB(0, 0, 0)
    
    # ═══════════════════════════════════════════
    # ZONE 4: Signature Blocks (bottom-right)
    # Two side-by-side blocks with fixed dimensions
    # Employee signature: center-right area
    # Trainer signature: far-right area
    # ═══════════════════════════════════════════
    
    # Layout constants for signature blocks
    SIG_BLOCK_W = 200   # Width of each signature block
    SIG_BLOCK_H = 90    # Height of each signature block
    SIG_BLOCK_Y = 100   # Bottom of signature blocks
    SIG_GAP = 30        # Gap between the two blocks
    
    # Position blocks: start from center of page going right
    emp_block_x = width / 2.0 - 20
    trainer_block_x = emp_block_x + SIG_BLOCK_W + SIG_GAP
    
    # Draw employee signature block
    _draw_signature_block(
        c_pdf,
        sig_base64=c.firma_empleado_snapshot,
        label="Firma del Empleado",
        name=c.empleado.nombre_completo if c.empleado else "N/A",
        block_x=emp_block_x,
        block_y=SIG_BLOCK_Y,
        block_w=SIG_BLOCK_W,
        block_h=SIG_BLOCK_H
    )
    
    # Draw trainer/consultant signature block
    _draw_signature_block(
        c_pdf,
        sig_base64=c.firma_capacitador_snapshot,
        label="Firma del Instructor / Representante",
        name="HDI Certificaciones",
        block_x=trainer_block_x,
        block_y=SIG_BLOCK_Y,
        block_w=SIG_BLOCK_W,
        block_h=SIG_BLOCK_H
    )
    
    c_pdf.showPage()
    c_pdf.save()
    
    buffer.seek(0)
    headers = {
        'Content-Disposition': f'inline; filename="Certificado_{c.empleado.dni}_{emision}.pdf"'
    }
    return Response(buffer.getvalue(), headers=headers, media_type='application/pdf')
