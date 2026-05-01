import React, { useState } from 'react';
import { Routes, Route, Link, Outlet, useNavigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Clientes from './pages/Clientes';
import ClienteDetail from './pages/ClienteDetail';
import ClienteProgramadaDetail from './pages/ClienteProgramadaDetail';
import Empleados from './pages/Empleados';
import EmpleadoDetail from './pages/EmpleadoDetail';
import Capacitaciones from './pages/Capacitaciones';
import CapacitacionDetail from './pages/CapacitacionDetail';
import AreasAdmin from './pages/AreasAdmin';
import Vencimientos from './pages/Vencimientos';
import PlanAnual from './pages/PlanAnual';
import Login from './pages/Login';
import Register from './pages/Register';
import EvaluacionEmpleado from './pages/Evaluacion';
import EmpleadoPortal from './pages/EmpleadoPortal';
import LoginDNI from './pages/LoginDNI';
import VerificarCertificado from './pages/VerificarCertificado';
import AdminProfileModal from './components/AdminProfileModal';
import AdminRoute from './components/ProtectedRoute';
import { adminAuthService } from './services/authService';

function Layout() {
  const [showProfileModal, setShowProfileModal] = useState(false);
  const navigate = useNavigate();
  const session = adminAuthService.getSession();
  const adminNombre = session?.user?.nombre || 'Administrador';

  const handleLogout = () => {
    adminAuthService.logout();
    navigate('/admin-login');
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header" style={{ fontSize: '1.25rem', letterSpacing: '-0.5px' }}>
          <span style={{ fontWeight: 800 }}>HDI</span>
          <span style={{ fontWeight: 400, marginLeft: '4px', opacity: 0.9 }}>Consultores</span>
          <span style={{ color: 'var(--secondary-color)', fontWeight: 800, marginLeft: '2px' }}>.</span>
        </div>
        <nav className="sidebar-nav">
          <Link to="/admin">Dashboard Principal</Link>
          <Link to="/admin/clientes">Directorio de Clientes</Link>
          <Link to="/admin/empleados">Empleados</Link>
          <Link to="/admin/capacitaciones">Catálogo Cursos</Link>
          <Link to="/admin/areas">Gestión de Áreas</Link>
          <Link to="/admin/vencimientos">Control Vencimientos</Link>
        </nav>
      </aside>
      
      <main className="main-content">
        <header className="topbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span className="badge badge-success">Administrador</span>
            <span style={{ marginLeft: '0.75rem', color: '#475569', fontSize: '0.85rem', fontWeight: 500 }}>
              {adminNombre}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button 
              onClick={() => setShowProfileModal(true)}
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '6px',
                border: '1px solid #e2e8f0',
                background: 'white',
                color: '#475569',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              ✍️ Mi Firma
            </button>
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '6px',
                border: '1px solid #fecaca',
                background: '#fff5f5',
                color: '#dc2626',
                fontSize: '0.85rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#fee2e2';
                e.currentTarget.style.borderColor = '#f87171';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = '#fff5f5';
                e.currentTarget.style.borderColor = '#fecaca';
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              Salir
            </button>
          </div>
        </header>
        <section className="content-area">
          <Outlet />
          {showProfileModal && (
            <AdminProfileModal onClose={() => setShowProfileModal(false)} />
          )}
        </section>
      </main>
    </div>
  );
}

function App() {
  return (
    <Routes>
      {/* Rutas públicas */}
      <Route path="/" element={<LoginDNI />} />
      <Route path="/admin-login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/empleado" element={<EmpleadoPortal />} />
      <Route path="/evaluacion" element={<EvaluacionEmpleado />} />
      <Route path="/verificar/:codigo" element={<VerificarCertificado />} />

      {/* Rutas protegidas — solo admin */}
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <Layout />
          </AdminRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="clientes/:id" element={<ClienteDetail />} />
        <Route path="clientes/:id/programadas/:programadaId" element={<ClienteProgramadaDetail />} />
        <Route path="empleados" element={<Empleados />} />
        <Route path="empleados/:id" element={<EmpleadoDetail />} />
        <Route path="capacitaciones" element={<Capacitaciones />} />
        <Route path="capacitaciones/:id" element={<CapacitacionDetail />} />
        <Route path="areas" element={<AreasAdmin />} />
        <Route path="vencimientos" element={<Vencimientos />} />
        <Route path="plan-anual/:id" element={<PlanAnual />} />
      </Route>
    </Routes>
  );
}

export default App;
