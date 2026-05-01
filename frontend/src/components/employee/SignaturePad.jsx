import React, { useRef, useState, useEffect } from 'react';

/**
 * Canvas-based signature pad component.
 * Captures freehand drawing and outputs base64 PNG.
 */
export default function SignaturePad({ initialSignature, onSave, saving }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    // Default style
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw initial signature if exists
    if (initialSignature) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasSignature(true);
      };
      img.src = initialSignature;
    }
  }, [initialSignature]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e) => {
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
    setHasSignature(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext('2d');
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  };

  const stopDrawing = (e) => {
    if (e) e.preventDefault();
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSave = () => {
    if (!hasSignature) return;
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
  };

  return (
    <div style={{
      background: 'white',
      borderRadius: '16px',
      border: '1px solid var(--border-color, #e2e8f0)',
      padding: '1.5rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1a1a2e' }}>
            ✍️ Mi Firma Digital
          </h4>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#64748b' }}>
            Dibuje su firma en el recuadro. Se incluirá en sus certificados.
          </p>
        </div>
      </div>

      <div style={{
        borderRadius: '12px',
        border: '2px dashed #cbd5e1',
        background: '#f8fafc',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'crosshair',
      }}>
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          style={{
            width: '100%',
            height: '180px',
            display: 'block',
            touchAction: 'none',
          }}
        />
        {!hasSignature && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#94a3b8',
            fontSize: '0.9rem',
            pointerEvents: 'none',
            fontStyle: 'italic',
          }}>
            Firme aquí
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
        <button
          onClick={clearCanvas}
          disabled={saving}
          style={{
            padding: '0.5rem 1.25rem',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            background: 'white',
            color: '#64748b',
            fontWeight: 600,
            fontSize: '0.85rem',
            cursor: 'pointer',
          }}
        >
          Limpiar
        </button>
        <button
          onClick={handleSave}
          disabled={!hasSignature || saving}
          style={{
            padding: '0.5rem 1.25rem',
            borderRadius: '8px',
            border: 'none',
            background: hasSignature ? 'var(--primary-color, #6366f1)' : '#e2e8f0',
            color: hasSignature ? 'white' : '#94a3b8',
            fontWeight: 600,
            fontSize: '0.85rem',
            cursor: hasSignature ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s',
          }}
        >
          {saving ? 'Guardando...' : 'Guardar Firma'}
        </button>
      </div>
    </div>
  );
}
