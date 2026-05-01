import React, { useState } from 'react';

export default function Register() {
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const handleRegister = (e) => {
    e.preventDefault();
    alert("¡Flujo conectado! Aquí se llamaría a Firebase createUserWithEmailAndPassword, y luego se crearía el usuario en el PostgreSQL de FastAPI.");
    window.location.href = '/'; 
  };

  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center', 
      height: '100vh', background: 'var(--primary-color)'
    }}>
      <div className="card" style={{ width: '400px', textAlign: 'center' }}>
        <h2 style={{color: 'var(--primary-color)', margin: '0 0 1rem 0'}}>HDI Consultores</h2>
        <p style={{color: 'var(--text-light)', marginBottom: '2rem'}}>Registro de Nuevo Usuario Administrador</p>
        
        <form onSubmit={handleRegister} style={{textAlign: 'left'}}>
          <label style={{fontWeight: 500, display: 'block', marginBottom: '0.5rem'}}>Nombre Completo</label>
          <input 
            type="text" 
            value={nombre} 
            onChange={e => setNombre(e.target.value)} 
            placeholder="Juan Pérez"
            required 
          />

          <label style={{fontWeight: 500, display: 'block', marginBottom: '0.5rem'}}>Correo Corporativo</label>
          <input 
            type="email" 
            value={email} 
            onChange={e => setEmail(e.target.value)} 
            placeholder="usuario@hdiconsultores.com"
            required 
          />
          
          <label style={{fontWeight: 500, display: 'block', marginBottom: '0.5rem'}}>Contraseña Segura</label>
          <input 
            type="password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            placeholder="••••••••"
            required 
          />

          <button type="submit" className="btn btn-primary" style={{width: '100%', fontSize: '1rem', padding: '0.75rem'}}>
            Crear Cuenta B2B
          </button>
          
          <p style={{textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem'}}>
            ¿Ya tienes cuenta? <a href="/" style={{color: 'var(--secondary-color)'}}>Iniciar Sesión</a>
          </p>
        </form>
      </div>
    </div>
  );
}
