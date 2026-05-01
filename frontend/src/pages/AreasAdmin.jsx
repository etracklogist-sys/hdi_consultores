import React, { useEffect, useState } from 'react';
import { authFetch } from '../utils/apiClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export default function AreasAdmin() {
  const [areas, setAreas] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState(null);
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState(null);

  const fetchAreas = async () => {
    try {
      const res = await authFetch(`${API_URL}/areas/`);
      if (res.ok) setAreas(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { fetchAreas(); }, []);

  const openModal = (area = null) => {
    setEditingArea(area);
    setNombre(area ? area.nombre : '');
    setError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!nombre.trim()) return;
    setError(null);

    const url = editingArea ? `${API_URL}/areas/${editingArea.id}` : `${API_URL}/areas/`;
    const method = editingArea ? 'PUT' : 'POST';

    try {
      const res = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombre.trim() })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Error al guardar');
      }
      setIsModalOpen(false);
      fetchAreas();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleToggle = async (areaId) => {
    await authFetch(`${API_URL}/areas/${areaId}/toggle`, { method: 'PUT' });
    fetchAreas();
  };

  const handleDelete = async (areaId) => {
    if (!confirm('¿Eliminar esta área? Se desvinculará de todos los clientes y empleados.')) return;
    await authFetch(`${API_URL}/areas/${areaId}`, { method: 'DELETE' });
    fetchAreas();
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h2 style={{margin: 0}}>Gestión de Áreas</h2>
          <p style={{color: 'var(--text-light)', margin: '0.25rem 0 0'}}>Administre las áreas de trabajo reutilizables para todos los clientes.</p>
        </div>
        <button className="btn btn-primary" onClick={() => openModal()}>+ Nueva Área</button>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '440px'}}>
            <h3 style={{marginTop: 0}}>{editingArea ? 'Editar Área' : 'Nueva Área de Trabajo'}</h3>
            {error && <div style={{padding: '0.75rem', marginBottom: '1rem', background: '#ffe0e0', color: '#c00', borderRadius: '4px'}}>{error}</div>}
            <form onSubmit={handleSave}>
              <label>Nombre del Área</label>
              <input type="text" required value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Mantenimiento" style={{width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1rem'}} />
              <div style={{display: 'flex', gap: '1rem', justifyContent: 'flex-end'}}>
                <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card" style={{padding: 0, overflow: 'hidden'}}>
        <table style={{width: '100%', borderCollapse: 'collapse', textAlign: 'left'}}>
          <thead style={{background: '#f8fafc', borderBottom: '1px solid var(--border-color)'}}>
            <tr>
              <th style={{padding: '1rem'}}>ID</th>
              <th style={{padding: '1rem'}}>Nombre</th>
              <th style={{padding: '1rem'}}>Estado</th>
              <th style={{padding: '1rem', textAlign: 'right'}}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {areas.map(a => (
              <tr key={a.id} style={{borderBottom: '1px solid var(--border-color)'}}>
                <td style={{padding: '1rem', color: 'var(--text-light)'}}>{a.id}</td>
                <td style={{padding: '1rem', fontWeight: 500}}>{a.nombre}</td>
                <td style={{padding: '1rem'}}>
                  <span className={`badge ${a.activo ? 'badge-success' : 'badge-danger'}`}>
                    {a.activo ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
                <td style={{padding: '1rem', textAlign: 'right'}}>
                  <div style={{display: 'flex', gap: '0.5rem', justifyContent: 'flex-end'}}>
                    <button className="btn btn-outline" style={{padding: '0.25rem 0.75rem', fontSize: '0.85rem'}} onClick={() => openModal(a)}>Editar</button>
                    <button className="btn" style={{padding: '0.25rem 0.75rem', fontSize: '0.85rem', color: a.activo ? 'var(--accent-red)' : 'var(--accent-green)'}} onClick={() => handleToggle(a.id)}>
                      {a.activo ? 'Desactivar' : 'Activar'}
                    </button>
                    <button className="btn" style={{padding: '0.25rem 0.75rem', fontSize: '0.85rem', color: 'var(--accent-red)'}} onClick={() => handleDelete(a.id)}>Eliminar</button>
                  </div>
                </td>
              </tr>
            ))}
            {areas.length === 0 && (
              <tr><td colSpan="4" style={{padding: '2rem', textAlign: 'center', color: 'var(--text-light)'}}>No hay áreas registradas</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
