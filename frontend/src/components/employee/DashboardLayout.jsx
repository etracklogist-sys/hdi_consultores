import React from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';

export default function DashboardLayout({ children, activeView, onSetView }) {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Resumen', icon: '📊' },
    { id: 'trainings', label: 'Capacitaciones', icon: '🛡️' },
    { id: 'certificados', label: 'Mis Certificados', icon: '🏆' },
    { id: 'profile', label: 'Mi Perfil', icon: '👤' },
  ];

  const handleLogout = () => {
    authService.logout();
    navigate('/');
  };

  return (
    <div className="dashboard-container">
      {/* Mobile hamburger */}
      <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
        {mobileMenuOpen ? '✕' : '☰'}
      </button>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div className="mobile-overlay active" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`sidebar-saas ${mobileMenuOpen ? "open" : ""}`}>
        <div className="sidebar-logo">
          HDI<span style={{color: 'var(--primary-color)', fontWeight: 800}}> Consultores</span>
        </div>
        
        <nav style={{ flex: 1 }}>
          {menuItems.map(item => (
            <button
              key={item.id}
              className={`nav-item-saas ${activeView === item.id ? 'active' : ''} ${item.disabled ? 'disabled-nav' : ''}`}
              onClick={() => { if (!item.disabled) { onSetView(item.id); setMobileMenuOpen(false); } }}
              style={{ 
                width: '100%', 
                border: 'none', 
                background: 'none', 
                textAlign: 'left',
                cursor: item.disabled ? 'not-allowed' : 'pointer',
                opacity: item.disabled ? 0.5 : 1
              }}
            >
              <span style={{ fontSize: '1.1rem' }}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div style={{ padding: '1rem 0.75rem', borderTop: '1px solid var(--border-color)', marginTop: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ 
              width: '32px', height: '32px', borderRadius: '50%', 
              background: 'var(--primary-faint)', color: 'var(--primary-color)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: '0.8rem'
            }}>
              {user?.empleado?.nombre_completo?.charAt(0) || 'U'}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                {user?.empleado?.nombre_completo}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-light)' }}>{user?.empleado?.empresa || 'Portal del Empleado'}</div>
            </div>
          </div>
          <button 
            className="btn" 
            style={{ 
              width: '100%', justifyContent: 'flex-start', background: '#F8FAFC', 
              color: 'var(--text-light)', border: '1px solid var(--border-color)' 
            }}
            onClick={handleLogout}
          >
            🚪 Cerrar Sesión
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content-saas">
        {children}
      </main>
    </div>
  );
}
