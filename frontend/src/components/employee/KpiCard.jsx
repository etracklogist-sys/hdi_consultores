import React from 'react';

export default function KpiCard({ label, value, subtext, icon, iconBg, iconColor }) {
  return (
    <div className="card-saas kpi-card-saas">
      <div className="icon" style={{ backgroundColor: iconBg, color: iconColor }}>
        {icon}
      </div>
      <div style={{ color: 'var(--text-light)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0.25rem 0' }}>
        {value.toString().padStart(2, '0')}
      </div>
      {subtext && (
        <div style={{ color: 'var(--text-light)', fontSize: '0.7rem' }}>
          {subtext}
        </div>
      )}
    </div>
  );
}
