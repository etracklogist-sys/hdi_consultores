import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAuthService } from '../services/authService';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Ingrese su correo y contraseña.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await adminAuthService.login(email, password);
      navigate('/admin');
    } catch (err) {
      setError(err.message || 'Error de autenticación. Verifique sus credenciales.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .login-bg-container {
          position: relative;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
          overflow: hidden;
          padding: 1rem;
        }

        .login-bg-container::before,
        .login-bg-container::after {
          content: '';
          position: absolute;
          width: 600px;
          height: 600px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(56,189,248,0.1) 0%, rgba(0,0,0,0) 70%);
          animation: floatGlow 15s infinite ease-in-out;
          pointer-events: none;
        }

        .login-bg-container::before {
          top: -150px;
          left: -150px;
        }

        .login-bg-container::after {
          bottom: -200px;
          right: -100px;
          background: radial-gradient(circle, rgba(43,182,115,0.08) 0%, rgba(0,0,0,0) 70%);
          animation: floatGlowReverse 12s infinite ease-in-out;
        }

        @keyframes floatGlow {
          0% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(50px, 30px) scale(1.05); }
          100% { transform: translate(0, 0) scale(1); }
        }

        @keyframes floatGlowReverse {
          0% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-40px, -40px) scale(1.1); }
          100% { transform: translate(0, 0) scale(1); }
        }

        .login-card {
          position: relative;
          z-index: 10;
          width: 100%;
          max-width: 420px;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(12px);
          border-radius: 16px;
          padding: 2.5rem 2.5rem 3rem 2.5rem;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25), 
                      0 0 0 1px rgba(255, 255, 255, 0.1) inset;
        }

        .login-input {
          width: 100%;
          padding: 0.8rem 1rem;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          font-family: inherit;
          font-size: 0.95rem;
          color: #0f172a;
          background: #f8fafc;
          transition: all 0.2s ease;
          box-sizing: border-box;
        }

        .login-input:focus {
          outline: none;
          border-color: #3b82f6;
          background: #ffffff;
          box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
        }

        .login-input:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .login-button {
          width: 100%;
          padding: 0.85rem;
          background: #2F5DAA;
          color: white;
          border: none;
          border-radius: 8px;
          font-family: inherit;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 6px -1px rgba(47, 93, 170, 0.2);
          margin-top: 1rem;
        }

        .login-button:hover:not(:disabled) {
          background: #254a8a;
          transform: translateY(-2px);
          box-shadow: 0 8px 15px -3px rgba(47, 93, 170, 0.3);
        }

        .login-button:disabled {
          opacity: 0.7;
          cursor: not-allowed;
          transform: none;
        }

        .login-button:active:not(:disabled) {
          transform: translateY(0);
        }

        .login-error {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #991b1b;
          border-radius: 8px;
          padding: 0.75rem 1rem;
          font-size: 0.875rem;
          margin-bottom: 1.25rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
      `}</style>

      <div className="login-bg-container">
        <div className="login-card">
          <div style={{textAlign: 'center', marginBottom: '2.5rem'}}>
            <h1 style={{color: '#0f172a', margin: '0 0 0.5rem 0', fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.03em'}}>
              HDI Consultores
            </h1>
            <p style={{color: '#64748b', margin: 0, fontSize: '0.95rem'}}>
              Portal de Administración
            </p>
          </div>

          {error && (
            <div className="login-error">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink: 0}}>
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
              {error}
            </div>
          )}
          
          <form onSubmit={handleLogin} style={{textAlign: 'left'}}>
            <div style={{marginBottom: '1.5rem'}}>
              <label style={{fontWeight: 600, display: 'block', marginBottom: '0.5rem', color: '#334155', fontSize: '0.9rem'}}>
                Correo Corporativo
              </label>
              <input 
                id="admin-email"
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                placeholder="admin@hdiconsultores.com"
                required
                disabled={loading}
                className="login-input"
              />
            </div>
            
            <div style={{marginBottom: '1.75rem'}}>
              <label style={{fontWeight: 600, display: 'block', marginBottom: '0.5rem', color: '#334155', fontSize: '0.9rem'}}>
                Contraseña
              </label>
              <input 
                id="admin-password"
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="••••••••"
                required
                disabled={loading}
                className="login-input"
              />
            </div>

            <button type="submit" id="admin-login-btn" className="login-button" disabled={loading}>
              {loading ? 'Verificando...' : 'Ingresar al portal'}
            </button>
          </form>

          <div style={{textAlign: 'center', marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0'}}>
            <a 
              href="/" 
              style={{color: '#64748b', fontSize: '0.85rem', textDecoration: 'none', fontWeight: 500}}
            >
              Acceso empleados →
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
