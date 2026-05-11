import React, { useState, useRef } from 'react';
import { authFetch } from '../utils/apiClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export default function ImportEmpleadosModal({ isOpen, onClose, onSuccess, clientes }) {
  const [file, setFile] = useState(null);
  const [clienteId, setClienteId] = useState('');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) validateAndSetFile(droppedFile);
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) validateAndSetFile(selected);
  };

  const validateAndSetFile = (f) => {
    const ext = f.name.toLowerCase();
    if (!ext.endsWith('.csv') && !ext.endsWith('.xlsx') && !ext.endsWith('.xls')) {
      setError('Solo se permiten archivos .csv, .xlsx o .xls');
      return;
    }
    setError('');
    setResult(null);
    setFile(f);
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Seleccioná un archivo primero.');
      return;
    }
    if (!clienteId) {
      setError('Seleccioná la empresa a la que pertenecen los empleados.');
      return;
    }

    setUploading(true);
    setError('');
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const url = `${API_URL}/empleados/bulk?cliente_id=${clienteId}`;
      const res = await authFetch(url, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Error HTTP ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
      if (data.created > 0) {
        onSuccess?.();
      }
    } catch (err) {
      setError(err.message || 'Error al importar');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setClienteId('');
    setResult(null);
    setError('');
    setUploading(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.4rem' }}>📥</span>
            Importar Empleados
          </h3>
          <button 
            onClick={handleClose}
            style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#94a3b8', lineHeight: 1 }}
          >×</button>
        </div>

        {/* Step 1: Select Client */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.9rem', color: '#334155' }}>
            1. Empresa destino
          </label>
          <select
            value={clienteId}
            onChange={e => setClienteId(e.target.value)}
            disabled={uploading}
            style={{ width: '100%' }}
          >
            <option value="">-- Seleccionar empresa --</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
          </select>
        </div>

        {/* Step 2: File Upload Zone */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600, fontSize: '0.9rem', color: '#334155' }}>
            2. Archivo Excel o CSV
          </label>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? '#2563eb' : file ? '#10b981' : '#cbd5e1'}`,
              borderRadius: '12px',
              padding: '2rem 1.5rem',
              textAlign: 'center',
              cursor: 'pointer',
              background: dragging ? '#eff6ff' : file ? '#f0fdf4' : '#f8fafc',
              transition: 'all 0.2s ease',
            }}
          >
            {file ? (
              <div>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                  {file.name.endsWith('.csv') ? '📄' : '📊'}
                </div>
                <div style={{ fontWeight: 600, color: '#059669' }}>{file.name}</div>
                <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  {(file.size / 1024).toFixed(1)} KB
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setFile(null); setResult(null); }}
                  style={{
                    marginTop: '0.75rem',
                    background: 'none',
                    border: '1px solid #e2e8f0',
                    borderRadius: '6px',
                    padding: '0.3rem 0.75rem',
                    fontSize: '0.8rem',
                    color: '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  Cambiar archivo
                </button>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem', opacity: 0.6 }}>📁</div>
                <div style={{ fontWeight: 600, color: '#334155' }}>
                  Arrastrá tu archivo aquí
                </div>
                <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '0.25rem' }}>
                  o hacé click para seleccionar
                </div>
                <div style={{
                  display: 'inline-flex',
                  gap: '0.5rem',
                  marginTop: '0.75rem',
                  fontSize: '0.75rem',
                  color: '#94a3b8',
                }}>
                  <span style={{ background: '#f1f5f9', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>.xlsx</span>
                  <span style={{ background: '#f1f5f9', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>.xls</span>
                  <span style={{ background: '#f1f5f9', padding: '0.15rem 0.5rem', borderRadius: '4px' }}>.csv</span>
                </div>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
        </div>

        {/* Expected Format Info */}
        <div style={{
          background: '#eff6ff',
          border: '1px solid #bfdbfe',
          borderRadius: '8px',
          padding: '0.75rem 1rem',
          fontSize: '0.82rem',
          color: '#1e40af',
          marginBottom: '1.25rem',
          lineHeight: 1.5,
        }}>
          <strong>Columnas esperadas:</strong> Nombre, Apellido (opcional), DNI, Email (opcional), Area (opcional).
          <br />
          <span style={{ opacity: 0.8 }}>Los nombres de columna son flexibles (ej: "documento" = "DNI", "correo" = "email").</span>
        </div>

        {/* Error Display */}
        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            padding: '0.75rem 1rem',
            color: '#dc2626',
            fontSize: '0.9rem',
            marginBottom: '1rem',
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* Result Display */}
        {result && (
          <div style={{
            background: result.created > 0 ? '#f0fdf4' : '#fffbeb',
            border: `1px solid ${result.created > 0 ? '#bbf7d0' : '#fde68a'}`,
            borderRadius: '10px',
            padding: '1.25rem',
            marginBottom: '1rem',
          }}>
            <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '0.75rem', color: '#0f172a' }}>
              📋 Resultado de la importación
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
              <div style={{ textAlign: 'center', background: '#dcfce7', borderRadius: '8px', padding: '0.75rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#16a34a' }}>{result.created}</div>
                <div style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 600 }}>Creados</div>
              </div>
              <div style={{ textAlign: 'center', background: '#fef3c7', borderRadius: '8px', padding: '0.75rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#d97706' }}>{result.skipped}</div>
                <div style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 600 }}>Ya existían</div>
              </div>
              <div style={{ textAlign: 'center', background: result.errors > 0 ? '#fee2e2' : '#f0f9ff', borderRadius: '8px', padding: '0.75rem' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: result.errors > 0 ? '#dc2626' : '#64748b' }}>{result.errors}</div>
                <div style={{ fontSize: '0.75rem', color: result.errors > 0 ? '#b91c1c' : '#64748b', fontWeight: 600 }}>Errores</div>
              </div>
            </div>
            
            {result.columns_detected && (
              <div style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: '0.5rem' }}>
                Columnas detectadas: {result.columns_detected.join(', ')}
              </div>
            )}
            
            {result.error_details && result.error_details.length > 0 && (
              <div style={{ marginTop: '0.5rem' }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#991b1b', marginBottom: '0.3rem' }}>Detalle de errores:</div>
                <div style={{ maxHeight: '120px', overflow: 'auto', fontSize: '0.78rem', color: '#7f1d1d' }}>
                  {result.error_details.map((e, i) => (
                    <div key={i} style={{ padding: '0.2rem 0', borderBottom: '1px solid #fecaca' }}>
                      <strong>Fila {e.fila}:</strong> {e.motivo}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <button type="button" className="btn" onClick={handleClose}>
            {result ? 'Cerrar' : 'Cancelar'}
          </button>
          {!result && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleUpload}
              disabled={!file || !clienteId || uploading}
              style={{
                opacity: (!file || !clienteId || uploading) ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              {uploading ? (
                <>
                  <span className="spinner" style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite',
                    display: 'inline-block',
                  }} />
                  Importando...
                </>
              ) : (
                '📤 Importar'
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
