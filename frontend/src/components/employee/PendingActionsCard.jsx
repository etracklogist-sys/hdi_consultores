import React from 'react';

const STATUS_CONFIG = {
  ASSIGNED: { label: 'Pendiente', color: '#f59e0b', bg: '#fef3c7', icon: '📋' },
  IN_PROGRESS: { label: 'En progreso', color: '#3b82f6', bg: '#dbeafe', icon: '🔄' },
  PENDING_EVALUATION: { label: 'Evaluación pend.', color: '#8b5cf6', bg: '#ede9fe', icon: '📝' },
  APPROVED: { label: 'Aprobado', color: '#10b981', bg: '#d1fae5', icon: '✅' },
  COMPLETED: { label: 'Completado', color: '#059669', bg: '#d1fae5', icon: '🎓' },
  CERTIFIED: { label: 'Certificado', color: '#0891b2', bg: '#cffafe', icon: '🏆' },
  VENCIDO: { label: 'Vencido', color: '#ef4444', bg: '#fee2e2', icon: '⚠️' },
};

function ProgressIndicators({ item }) {
  const steps = [
    { label: 'Material', done: item.material_viewed },
    ...(item.requiere_evaluacion ? [{ 
      label: 'Evaluación', 
      done: ['APPROVED', 'COMPLETED', 'CERTIFIED'].includes(item.estado_ui) 
    }] : []),
    { label: 'Completado', done: ['COMPLETED', 'CERTIFIED'].includes(item.estado_ui) },
  ];
  
  return (
    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem' }}>
      {steps.map((step, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.7rem', color: step.done ? '#10b981' : '#94a3b8' }}>
          <span>{step.done ? '✅' : '⬜'}</span>
          <span>{step.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function PendingActionsCard({ actions, onComenzar, onContinuar, onDownloadCert, onMarkCompleted }) {
  const filtered = actions
    .filter(a => ['ASSIGNED', 'IN_PROGRESS', 'PENDING_EVALUATION'].includes(a.estado_ui))
    .slice(0, 4);

  if (filtered.length === 0) {
    return (
      <div className="card-saas" style={{ textAlign: 'center', padding: '3rem' }}>
        <span style={{ fontSize: '2rem', display: 'block', marginBottom: '1rem' }}>🎉</span>
        <h3 style={{ margin: 0 }}>¡Todo al día!</h3>
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem' }}>No tienes capacitaciones pendientes por ahora.</p>
      </div>
    );
  }

  return (
    <div className="card-saas">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Acciones pendientes</h3>
        <span style={{ 
          fontSize: '0.7rem', 
          background: '#fee2e2', 
          color: '#ef4444', 
          padding: '0.2rem 0.6rem', 
          borderRadius: '12px',
          fontWeight: 700 
        }}>
          {filtered.length} pendiente{filtered.length > 1 ? 's' : ''}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        {filtered.map(item => {
          const config = STATUS_CONFIG[item.estado_ui] || STATUS_CONFIG.ASSIGNED;
          
          return (
            <div key={item.id} style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '1rem',
              padding: '0.75rem',
              borderRadius: '12px',
              background: '#f8fafc',
              transition: 'all 0.2s',
            }}>
              <div style={{ 
                width: '42px', height: '42px', borderRadius: '10px', 
                background: config.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                fontSize: '1.2rem',
                flexShrink: 0,
              }}>
                {config.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.nombre}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '0.15rem 0.5rem',
                    borderRadius: '6px',
                    background: config.bg,
                    color: config.color,
                  }}>
                    {config.label}
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-light, #64748b)' }}>
                    {item.modalidad === 'virtual' ? '💻' : '🏢'} {item.duracion_estimada || '—'}
                  </span>
                </div>
                <ProgressIndicators item={item} />
              </div>
              
              {/* CTA Button */}
              {item.estado_ui === 'IN_PROGRESS' && item.puede_continuar ? (
                <button 
                  className="btn" 
                  style={{ 
                    background: 'white', 
                    border: '1px solid var(--border-color)', 
                    borderRadius: '8px', 
                    padding: '0.4rem 1rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                  onClick={() => onContinuar(item)}
                >
                  Continuar
                </button>
              ) : item.puede_marcar_completada ? (
                <button 
                  className="btn" 
                  style={{ 
                    background: '#059669',
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px', 
                    padding: '0.4rem 1rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                  onClick={() => onMarkCompleted(item)}
                >
                  Completar ✓
                </button>
              ) : item.puede_comenzar ? (
                <button 
                  className="btn btn-primary" 
                  style={{ 
                    borderRadius: '8px', 
                    padding: '0.4rem 1rem',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                  }}
                  onClick={() => onComenzar(item)}
                >
                  {item.requiere_evaluacion && item.estado_ui === 'PENDING_EVALUATION' 
                    ? 'Evaluar' 
                    : 'Comenzar'}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      {actions.length > filtered.length && (
        <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--primary-color)', fontWeight: 700, cursor: 'pointer' }}>
            Ver todas mis capacitaciones ({actions.length}) →
          </span>
        </div>
      )}
    </div>
  );
}
