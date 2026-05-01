import React from 'react';

export default function Loading({ message = "Cargando componentes..." }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem 2rem', color: 'var(--text-light)' }}>
      <div style={{
        width: '40px', height: '40px', 
        border: '3px solid var(--border-color)', 
        borderTop: '3px solid var(--primary-color)', 
        borderRadius: '50%', 
        animation: 'spin 1s linear infinite',
        marginBottom: '1rem'
      }} />
      <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      <p style={{ margin: 0, fontWeight: 500, letterSpacing: '0.02em' }}>{message}</p>
    </div>
  );
}
