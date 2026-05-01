import React, { useState, useEffect } from 'react';
import { authFetch } from '../utils/apiClient';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
import SignaturePad from './employee/SignaturePad';

export default function AdminProfileModal({ onClose }) {
  const [firmaBase64, setFirmaBase64] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    fetchFirma();
  }, []);

  const fetchFirma = async () => {
    try {
      const res = await authFetch(`${API_URL}/admin/profile/firma`);
      if (res.ok) {
        const data = await res.json();
        setFirmaBase64(data.firma_base64);
      }
    } catch (err) {
      console.error("Error fetching admin signature:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFirma = async (base64) => {
    setSaving(true);
    setNotification(null);
    try {
      const res = await authFetch(`${API_URL}/admin/profile/firma`, {
        method: 'POST',
        body: JSON.stringify({ firma_base64: base64 }),
      });
      if (res.ok) {
        setNotification({ type: 'success', message: 'Firma guardada exitosamente.' });
        setFirmaBase64(base64);
      } else {
        const errData = await res.json();
        throw new Error(errData.detail || 'Error al guardar la firma');
      }
    } catch (err) {
      setNotification({ type: 'error', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="modal-overlay">
        <div className="modal-content" style={{ width: '450px', textAlign: 'center' }}>
          <p>Cargando perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ width: '450px', padding: '0' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#1a1a2e' }}>Mi Perfil</h2>
          <button 
            onClick={onClose}
            style={{
              background: 'none', border: 'none', fontSize: '1.5rem', 
              color: '#64748b', cursor: 'pointer', lineHeight: 1
            }}
          >
            &times;
          </button>
        </div>
        
        <div style={{ padding: '1.5rem', background: '#f8fafc' }}>
          {notification && (
            <div className={`notification notification-${notification.type}`} style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: '8px', fontSize: '0.9rem' }}>
              {notification.message}
            </div>
          )}

          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', color: '#334155', marginBottom: '0.5rem', fontWeight: 600 }}>Firma del Administrador / Capacitador</h3>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem', lineHeight: 1.5 }}>
              Esta firma se utilizará en los certificados emitidos al aprobar una capacitación.
            </p>
            <SignaturePad 
              initialSignature={firmaBase64} 
              onSave={handleSaveFirma} 
              saving={saving} 
            />
          </div>
          
        </div>
      </div>
    </div>
  );
}
