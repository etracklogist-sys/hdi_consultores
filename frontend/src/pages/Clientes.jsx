import React, { useEffect, useState } from 'react';
import { authFetch } from '../utils/apiClient';
import { Link, useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [rubros, setRubros] = useState([]);
  const [areas, setAreas] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ razon_social: '', cuit: '', rubro_id: '', area_ids: [] });
  const navigate = useNavigate();

  const [formError, setFormError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchClientes = async () => {
    try {
      const res = await authFetch(`${API_URL}/clientes/`);
      if (res.ok) setClientes(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    const loadInitData = async () => {
      await fetchClientes();
      try {
        const resRubros = await authFetch(`${API_URL}/rubros/`);
        if (resRubros.ok) setRubros(await resRubros.json());
      } catch (e) { console.error(e); }
      
      try {
        const resAreas = await authFetch(`${API_URL}/areas/`);
        if (resAreas.ok) setAreas(await resAreas.json());
      } catch (e) { console.error(e); }
    };
    loadInitData();
  }, []);

  const openModal = () => {
    setFormError(null);
    setFormData({ razon_social: '', cuit: '', rubro_id: '', area_ids: [] });
    setIsModalOpen(true);
  };

  const toggleArea = (areaId) => {
    setFormData(prev => ({
      ...prev,
      area_ids: prev.area_ids.includes(areaId)
        ? prev.area_ids.filter(id => id !== areaId)
        : [...prev.area_ids, areaId]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    
    try {
      const res = await authFetch(`${API_URL}/clientes/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razon_social: formData.razon_social,
          cuit: formData.cuit,
          rubro_id: parseInt(formData.rubro_id),
          area_ids: formData.area_ids
        })
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Error HTTP: ${res.status}`);
      }
      
      setIsModalOpen(false);
      fetchClientes();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getRubroName = (rubroId) => {
    const r = rubros.find(x => x.id === rubroId);
    return r ? r.nombre : '—';
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{margin: 0}}>Directorio de Clientes</h2>
        <button className="btn btn-primary" onClick={openModal}>+ Agregar Cliente</button>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '560px'}}>
            <h3 style={{marginTop: 0}}>Nuevo Cliente Corporativo</h3>
            {formError && (
              <div style={{ padding: '0.75rem', marginBottom: '1rem', background: '#ffe0e0', color: '#c00', borderRadius: '4px', border: '1px solid #c00' }}>
                {formError}
              </div>
            )}
            <form onSubmit={handleSubmit}>
              <label>Razón Social</label>
              <input type="text" required value={formData.razon_social} onChange={e => setFormData({...formData, razon_social: e.target.value})} placeholder="Ej: TechCorp S.A." disabled={isSubmitting} />
              
              <label>CUIT Empresarial</label>
              <input type="text" required value={formData.cuit} onChange={e => setFormData({...formData, cuit: e.target.value})} placeholder="30-12345678-9" disabled={isSubmitting} />

              <label>Rubro <span style={{color: '#c00'}}>*</span></label>
              <select required value={formData.rubro_id} onChange={e => setFormData({...formData, rubro_id: e.target.value})} disabled={isSubmitting} style={{width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1rem'}}>
                <option value="">-- Seleccionar rubro --</option>
                {rubros.filter(r => r.activo).map(r => (
                  <option key={r.id} value={r.id}>{r.nombre}</option>
                ))}
              </select>

              <label>Áreas de trabajo (selección múltiple)</label>
              <div style={{display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.5rem', padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '8px', maxHeight: '150px', overflowY: 'auto'}}>
                {areas.filter(a => a.activo).map(a => (
                  <label key={a.id} style={{display: 'flex', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', padding: '0.25rem 0.5rem', borderRadius: '4px', background: formData.area_ids.includes(a.id) ? 'var(--secondary-color)' : '#f1f5f9', color: formData.area_ids.includes(a.id) ? '#fff' : 'inherit', fontSize: '0.9rem', transition: 'all 0.15s'}}>
                    <input 
                      type="checkbox" 
                      checked={formData.area_ids.includes(a.id)} 
                      onChange={() => toggleArea(a.id)} 
                      style={{display: 'none'}}
                    />
                    {a.nombre}
                  </label>
                ))}
                {areas.filter(a => a.activo).length === 0 && <span style={{color: 'var(--text-light)', fontSize: '0.85rem'}}>No hay áreas disponibles</span>}
              </div>
              
              <div style={{display: 'flex', gap: '1rem', marginTop: '1rem'}}>
                <button type="button" className="btn" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Cancelar</button>
                <button type="submit" className="btn btn-success" disabled={isSubmitting}>
                  {isSubmitting ? 'Guardando...' : 'Guardar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card" style={{padding: 0, overflow: 'hidden'}}>
        <table style={{width: '100%', borderCollapse: 'collapse', textAlign: 'left'}}>
          <thead style={{background: '#f8fafc', borderBottom: '1px solid var(--border-color)'}}>
            <tr>
              <th style={{padding: '1rem'}}>Razón Social</th>
              <th style={{padding: '1rem'}}>CUIT</th>
              <th style={{padding: '1rem'}}>Rubro</th>
              <th style={{padding: '1rem'}}>Estado</th>
              <th style={{padding: '1rem'}}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clientes.length > 0 ? clientes.map(c => (
              <tr 
                key={c.id} 
                className="clickable-row" 
                onClick={() => navigate(`/admin/clientes/${c.id}`)}
                style={{borderBottom: '1px solid var(--border-color)'}}
              >
                <td style={{padding: '1rem', fontWeight: 500}}>{c.razon_social}</td>
                <td style={{padding: '1rem'}}>{c.cuit}</td>
                <td style={{padding: '1rem'}}>{getRubroName(c.rubro_id)}</td>
                <td style={{padding: '1rem'}}>
                  <span className={`badge ${c.activo ? 'badge-success' : 'badge-danger'}`}>
                    {c.activo ? 'Vigente' : 'Crítico'}
                  </span>
                </td>
                <td style={{padding: '1rem'}} onClick={(e) => e.stopPropagation()}>
                  <Link to={`/admin/clientes/${c.id}`} className="btn" style={{background: '#eee', textDecoration: 'none'}}>Ver ficha</Link>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="5" style={{padding: '2rem', textAlign: 'center', color: 'var(--text-light)'}}>
                  No hay clientes registrados
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
