import React, { useEffect, useState } from 'react';
import { authFetch } from '../utils/apiClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export default function RubroAreaMatriz() {
  const [matriz, setMatriz] = useState([]);
  const [rubros, setRubros] = useState([]);
  const [areas, setAreas] = useState([]);
  const [capacitaciones, setCapacitaciones] = useState([]);
  
  const [formData, setFormData] = useState({ rubro_id: '', area_id: '', capacitacion_id: '' });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState(null);

  const loadData = async () => {
    try {
      const fetchJson = async (url) => {
        const res = await authFetch(url);
        return await res.json();
      };

      const [resMatriz, resRub, resAreas, resCaps] = await Promise.all([
        fetchJson(`${API_URL}/matriz/`),
        fetchJson(`${API_URL}/rubros/`),
        fetchJson(`${API_URL}/empleados/opciones/areas`),
        fetchJson(`${API_URL}/matriz/capacitaciones`)
      ]);
      setMatriz(resMatriz || []);
      setRubros(resRub || []);
      setAreas(resAreas || []);
      setCapacitaciones(resCaps || []);
    } catch (e) {
      console.error(e);
      setError("Error cargando datos de configuración");
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!formData.rubro_id || !formData.area_id || !formData.capacitacion_id) return;
    
    try {
      const res = await authFetch(`${API_URL}/matriz/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rubro_id: parseInt(formData.rubro_id),
          area_id: parseInt(formData.area_id),
          capacitacion_id: parseInt(formData.capacitacion_id)
        })
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.detail || "Error al asignar");
      }
      await res.json();
      
      setIsModalOpen(false);
      setFormData({ rubro_id: '', area_id: '', capacitacion_id: '' });
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if(!window.confirm("¿Seguro que deseas eliminar esta regla de la matriz?")) return;
    try {
      const res = await authFetch(`${API_URL}/matriz/${id}`, { method: 'DELETE' });
      if (!res.ok) { 
        const text = await res.text(); 
        throw new Error(`HTTP ${res.status}: ${text}`); 
      }
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{margin: 0}}>Matriz de Capacitaciones (Rubro + Área)</h2>
          <p style={{margin: '0.5rem 0 0 0', color: 'var(--text-light)'}}>Configura qué capacitaciones aplican automáticamente.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>+ Nueva Regla</button>
      </div>

      {error && <div style={{color: 'var(--accent-red)', marginBottom: '1rem'}}>{error}</div>}

      <div className="card" style={{padding: 0, overflow: 'hidden'}}>
        <table style={{width: '100%', borderCollapse: 'collapse', textAlign: 'left'}}>
          <thead style={{background: '#f8fafc', borderBottom: '1px solid var(--border-color)'}}>
            <tr>
              <th style={{padding: '1rem'}}>Rubro Industria</th>
              <th style={{padding: '1rem'}}>Área Organizacional</th>
              <th style={{padding: '1rem'}}>Capacitación Obligatoria</th>
              <th style={{padding: '1rem'}}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {matriz.length > 0 ? matriz.map(m => (
              <tr key={m.id} style={{borderBottom: '1px solid var(--border-color)'}}>
                <td style={{padding: '1rem', fontWeight: 500}}>{m.rubro_nombre}</td>
                <td style={{padding: '1rem', color: 'var(--text-light)'}}>{m.area_nombre}</td>
                <td style={{padding: '1rem'}}>{m.capacitacion_nombre}</td>
                <td style={{padding: '1rem'}}>
                  <button onClick={() => handleDelete(m.id)} className="btn btn-outline" style={{padding: '0.5rem 1rem', color: 'var(--accent-red)', borderColor: 'var(--accent-red)'}}>Eliminar</button>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="4" style={{padding: '2rem', textAlign: 'center', color: 'var(--text-light)'}}>
                  La matriz está vacía. No hay reglas automáticas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{marginTop: 0}}>Nueva Regla en la Matriz</h3>
            <form onSubmit={handleCreate}>
              <label style={{display: 'block', marginBottom: '0.5rem', fontWeight: 500}}>Rubro Industria</label>
              <select required value={formData.rubro_id} onChange={e => setFormData({...formData, rubro_id: e.target.value})} style={{marginBottom: '1rem', width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px'}}>
                <option value="">Selecciona un Rubro</option>
                {rubros.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>

              <label style={{display: 'block', marginBottom: '0.5rem', fontWeight: 500}}>Área Organizacional</label>
              <select required value={formData.area_id} onChange={e => setFormData({...formData, area_id: e.target.value})} style={{marginBottom: '1rem', width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px'}}>
                <option value="">Selecciona un Área</option>
                {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>

              <label style={{display: 'block', marginBottom: '0.5rem', fontWeight: 500}}>Capacitación a inyectar</label>
              <select required value={formData.capacitacion_id} onChange={e => setFormData({...formData, capacitacion_id: e.target.value})} style={{marginBottom: '1rem', width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px'}}>
                <option value="">Selecciona un Módulo</option>
                {capacitaciones.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>

              <div style={{display: 'flex', gap: '1rem', marginTop: '1rem'}}>
                <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-success">Crear Regla</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
