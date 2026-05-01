import React from 'react';

export default function ComplianceStatusCard({ percentage, total, completed, lastUpdate }) {
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="card-saas" style={{ padding: '2rem 1.5rem', textAlign: 'center' }}>
      <h3 style={{ marginBottom: '1.5rem', fontSize: '0.95rem' }}>Estado de cumplimiento</h3>
      
      <div className="circular-progress-saas" style={{ position: 'relative', width: '140px', height: '140px' }}>
        <svg width="140" height="140" viewBox="0 0 120 120">
          <circle className="bg" cx="60" cy="60" r={radius} fill="none" stroke="#F1F5F9" strokeWidth="8" />
          <circle 
            className="progress" 
            cx="60" cy="60" r={radius} 
            fill="none" 
            stroke="var(--primary-color)" 
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div className="text" style={{ position: 'absolute', top: '50.5%', left: '50%', transform: 'translate(-50%, -50%)' }}>
          <span className="value" style={{ fontSize: '1.75rem', fontWeight: 800 }}>{percentage}%</span>
          <span className="sub" style={{ fontSize: '0.6rem', color: 'var(--text-light)', fontWeight: 700 }}>CUMPLIMIENTO TOTAL</span>
        </div>
      </div>

      <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: percentage === 100 ? 'var(--accent-green)' : 'var(--accent-amber)' }}></div>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: percentage === 100 ? 'var(--accent-green)' : 'var(--accent-amber)' }}>
            Cumplimiento {percentage === 100 ? 'completo' : 'incompleto'}
          </span>
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>
          Última actualización: {lastUpdate || 'Reciente'}
        </div>
      </div>

      <div style={{ marginTop: '2rem', textAlign: 'left' }}>
        <div style={{ marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.35rem', fontWeight: 500 }}>
            <span style={{ color: 'var(--text-light)' }}>Capacitaciones</span>
            <span style={{ color: 'var(--text-dark)', fontWeight: 700 }}>{percentage}%</span>
          </div>
          <div style={{ height: '4px', background: '#F1F5F9', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${percentage}%`, height: '100%', background: 'var(--primary-color)', borderRadius: '2px' }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}
