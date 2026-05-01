import React from 'react';

export default function ConfirmModal({ title = '¿Estás seguro?', message = 'Esta acción no se puede deshacer.', onConfirm, onCancel, confirmText = 'Confirmar', cancelText = 'Cancelar', isDanger = false, isLoading = false }) {
  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{maxWidth: '400px', textAlign: 'center', padding: '2.5rem 2rem'}}>
        <div style={{fontSize: '3rem', marginBottom: '1rem', opacity: 0.9}}>
          {isDanger ? '⚠️' : '❓'}
        </div>
        <h3 style={{marginTop: 0, marginBottom: '0.5rem', color: isDanger ? '#b91c1c' : 'var(--text-dark)'}}>{title}</h3>
        <p style={{color: 'var(--text-light)', marginBottom: '2rem'}}>{message}</p>
        
        <div style={{display: 'flex', gap: '1rem', justifyContent: 'center'}}>
          <button className="btn" style={{background: '#f1f5f9', color: '#475569'}} onClick={onCancel} disabled={isLoading}>
            {cancelText}
          </button>
          <button className={`btn ${isDanger ? 'btn-danger' : 'btn-primary'}`} style={isDanger ? {background: '#ef4444', color: 'white'} : {}} onClick={onConfirm} disabled={isLoading}>
            {isLoading ? 'Procesando...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
