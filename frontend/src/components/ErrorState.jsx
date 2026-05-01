import React from 'react';

export default function ErrorState({ title = "Hubo un error", message = "No hemos podido cargar la información. Revisa tu conexión.", onRetry }) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem 2rem', background: '#fef2f2', borderRadius: '12px', border: '1px solid #fecaca' }}>
      <div style={{ fontSize: '3rem', opacity: 0.8, marginBottom: '1rem' }}>⚠️</div>
      <h3 style={{ margin: '0 0 0.5rem 0', color: '#991b1b' }}>{title}</h3>
      <p style={{ color: '#b91c1c', margin: '0 0 1.5rem 0' }}>{message}</p>
      {onRetry && (
        <button className="btn" style={{ background: 'white', color: '#991b1b', border: '1px solid #fca5a5' }} onClick={onRetry}>Intentar Nuevamente</button>
      )}
    </div>
  );
}
