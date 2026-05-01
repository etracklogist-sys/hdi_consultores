import React from 'react';

export default function EmptyState({ title = "No hay datos", description = "Aún no hay registros disponibles para mostrar.", actionText, onAction }) {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 2rem', background: '#f8fafc', borderRadius: '12px', border: '1px dashed var(--border-color)' }}>
      <div style={{ fontSize: '3rem', opacity: 0.2, marginBottom: '1rem' }}>📁</div>
      <h3 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-dark)' }}>{title}</h3>
      <p style={{ color: 'var(--text-light)', margin: '0 0 1.5rem 0', maxWidth: '400px', marginLeft: 'auto', marginRight: 'auto' }}>{description}</p>
      {onAction && actionText && (
        <button className="btn btn-primary" onClick={onAction}>{actionText}</button>
      )}
    </div>
  );
}
