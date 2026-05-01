import React from 'react';

export default function AlertBanner({ count, onAction }) {
  if (count === 0) return null;
  
  return (
    <div className="alert-banner-saas">
      <div className="message">
        <span style={{fontSize: '1.25rem'}}>⚠️</span>
        Tienes {count} capacitacione{count > 1 ? 's' : ''} pendiente{count > 1 ? 's' : ''}
      </div>
      <div className="action" onClick={onAction}>
        REVISAR AHORA
      </div>
    </div>
  );
}
