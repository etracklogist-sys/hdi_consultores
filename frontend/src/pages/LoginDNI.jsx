import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';

export default function LoginDNI() {
  const [dni, setDni] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!dni.trim()) {
      setError('Debes ingresar tu DNI.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Simulate backend auth check
      await authService.loginDNI(dni, null);
      navigate('/empleado'); // redirect to portal on success
    } catch (err) {
      setError(err.message || 'Error de autenticación. Verifica tus datos.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .login-dni-wrapper {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%);
          position: relative;
          padding: 2rem;
        }

        .login-dni-card {
          background: #FFFFFF;
          padding: 3.5rem 3rem 2.5rem 3rem;
          border-radius: 20px;
          box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.05), 0 8px 10px -6px rgba(15, 23, 42, 0.02);
          width: 100%;
          max-width: 480px;
          position: relative;
          z-index: 10;
          border: 1px solid #E2E8F0;
        }

        .login-dni-input {
          width: 100%;
          font-size: 1rem;
          padding: 0.85rem 1.15rem;
          background: #FFFFFF;
          border: 1px solid #CBD5E1;
          border-radius: 10px;
          color: #0F172A;
          transition: all 0.2s ease;
          box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.02);
        }

        .login-dni-input:focus {
          outline: none;
          border-color: #2563EB;
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.15);
        }

        .login-dni-btn {
          width: 100%;
          padding: 1rem;
          font-size: 1.05rem;
          font-weight: 700;
          background: #1E40AF;
          color: white;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 4px 6px -1px rgba(30, 64, 175, 0.15), 0 2px 4px -2px rgba(30, 64, 175, 0.1);
          margin-top: 0.5rem;
        }

        .login-dni-btn:hover:not(:disabled) {
          background: #2563EB;
          transform: translateY(-2px);
          box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.25), 0 4px 6px -4px rgba(37, 99, 235, 0.1);
        }
        
        .login-dni-btn:disabled {
          background: #94A3B8;
          cursor: not-allowed;
          box-shadow: none;
        }

        .admin-link {
          color: #94A3B8;
          text-decoration: none;
          font-size: 0.85rem;
          font-weight: 500;
          transition: all 0.2s ease;
          display: inline-block;
        }

        .admin-link:hover {
          color: #64748B;
          text-decoration: underline;
        }

        .info-box {
          background: #FEF2F2;
          border: 1px solid #FECACA;
          color: #991B1B;
          padding: 1rem 1.25rem;
          border-radius: 12px;
          margin-bottom: 2rem;
          font-size: 0.9rem;
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          line-height: 1.5;
        }
      `}</style>
      
      <div className="login-dni-wrapper">
        <div className="login-dni-card">
          <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: '#EFF6FF',
              color: '#1E40AF',
              marginBottom: '1.25rem'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
                <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
              </svg>
            </div>
            <h1 style={{ margin: 0, fontSize: '1.85rem', color: '#0F172A', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: '0.5rem' }}>
              HDI Consultores
            </h1>
            <h2 style={{ color: '#475569', margin: 0, fontSize: '1.05rem', fontWeight: 600, marginBottom: '0.75rem' }}>
              Portal In-Company Colaboradores
            </h2>
            <p style={{ margin: 0, color: '#64748B', fontSize: '0.9rem', lineHeight: 1.5 }}>
              Ingresa tus datos para acceder a tus capacitaciones asignadas y material de estudio.
            </p>
          </div>

          {error && (
            <div className="info-box">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              <div style={{ fontWeight: 500 }}>{error}</div>
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '1.5rem' }}>
              <label htmlFor="dni" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: '#1E293B', fontSize: '0.95rem' }}>DNI</label>
              <input
                type="text"
                id="dni"
                value={dni}
                onChange={(e) => setDni(e.target.value)}
                className="login-dni-input"
                placeholder="Ingresa tu DNI sin puntos"
                required
              />
            </div>

            <button 
              type="submit" 
              className="login-dni-btn"
              disabled={loading}
            >
              {loading ? 'Validando credenciales...' : 'Acceder al Portal'}
            </button>
          </form>
          
          <div style={{ textAlign: 'center', marginTop: '2.5rem', borderTop: '1px solid #E2E8F0', paddingTop: '1.5rem' }}>
            <p style={{ margin: '0 0 1.25rem 0', color: '#94A3B8', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              Plataforma segura de capacitación corporativa
            </p>
            <a href="/admin-login" className="admin-link">Acceso Administrativo →</a>
          </div>
        </div>
      </div>
    </>
  );
}
