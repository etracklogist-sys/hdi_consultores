import React, { useState, useEffect } from 'react';
import { authFetch } from '../utils/apiClient';
import { Link, useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export default function Capacitaciones() {
  const [capacitaciones, setCapacitaciones] = useState([]);
  const [rubros, setRubros] = useState([]);
  const [areas, setAreas] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ 
    nombre: '', descripcion: '', duracion_horas: 1, meses_vigencia: 12, 
    requiere_evaluacion: true, modalidad: 'presencial', puntaje_total: 10, puntaje_aprobacion: 7.5,
    rubro_id: '', area_id: ''
  });
  const [formError, setFormError] = useState(null);
  const navigate = useNavigate();

  const loadCatalog = async () => {
    try {
      const res = await authFetch(`${API_URL}/capacitaciones/`);
      if (res.ok) setCapacitaciones(await res.json());
    } catch (e) { console.error(e); }
  };

  useEffect(() => { 
    const initFetch = async () => {
      await loadCatalog();
      try {
        const r1 = await authFetch(`${API_URL}/rubros/`);
        if (r1.ok) setRubros(await r1.json());
      } catch (e) { setRubros([]); }
      
      try {
        const r2 = await authFetch(`${API_URL}/areas/`);
        if (r2.ok) setAreas(await r2.json());
      } catch (e) { setAreas([]); }
    };
    initFetch();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.rubro_id && !formData.area_id) {
      setFormError('Debe asignar al menos un Rubro o un Área a la capacitación.');
      return;
    }

    try {
      const res = await authFetch(`${API_URL}/capacitaciones/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: formData.nombre,
          descripcion: formData.descripcion,
          duracion_horas: parseInt(formData.duracion_horas),
          meses_vigencia: parseInt(formData.meses_vigencia),
          requiere_evaluacion: formData.requiere_evaluacion,
          modalidad: formData.modalidad,
          puntaje_total: parseFloat(formData.puntaje_total),
          puntaje_aprobacion: parseFloat(formData.puntaje_aprobacion),
          rubro_id: formData.rubro_id ? parseInt(formData.rubro_id) : null,
          area_id: formData.area_id ? parseInt(formData.area_id) : null
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Error al crear capacitación');
      }
      setIsModalOpen(false);
      setFormData({ nombre: '', descripcion: '', duracion_horas: 1, meses_vigencia: 12, requiere_evaluacion: true, modalidad: 'presencial', puntaje_total: 10, puntaje_aprobacion: 7.5, rubro_id: '', area_id: '' });
      loadCatalog();
    } catch (err) {
      setFormError(err.message);
    }
  };

  const modalidadLabel = (m) => ({ presencial: 'Presencial', virtual: 'Virtual', mixta: 'Mixta' }[m] || m);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h2 style={{margin: 0}}>Catálogo de Capacitaciones</h2>
        <button className="btn btn-primary" onClick={() => { setFormError(null); setIsModalOpen(true); }}>+ Crear Curso</button>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '560px', maxHeight: '90vh', display: 'flex', flexDirection: 'column'}}>
            <h3 style={{marginTop: 0}}>Nuevo Curso en Catálogo</h3>
            {formError && <div style={{padding: '0.75rem', marginBottom: '1rem', background: '#ffe0e0', color: '#c00', borderRadius: '4px'}}>{formError}</div>}
            <div style={{overflowY: 'auto', flex: 1}}>
              <form onSubmit={handleSubmit}>
                <label>Título / Nombre <span style={{color:'#c00'}}>*</span></label>
                <input type="text" required value={formData.nombre} onChange={e => setFormData({...formData, nombre: e.target.value})} />
                
                <label>Descripción</label>
                <textarea style={{width:'100%', padding:'0.5rem', marginBottom:'1rem', borderRadius: '8px', border: '1px solid var(--border-color)'}} value={formData.descripcion} onChange={e => setFormData({...formData, descripcion: e.target.value})} />
                
                {/* ELIGIBILITY RULES */}
                <div style={{padding: '1rem', background: '#f0f9ff', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #bae6fd'}}>
                  <p style={{margin: '0 0 0.75rem', fontWeight: 600, fontSize: '0.85rem', color: '#0369a1'}}>Reglas de Elegibilidad (al menos uno requerido)</p>
                  <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                    <div>
                      <label>Rubro</label>
                      <select value={formData.rubro_id} onChange={e => setFormData({...formData, rubro_id: e.target.value})} style={{width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)'}}>
                        <option value="">Sin restricción de rubro</option>
                        {rubros.filter(r => r.activo).map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                      </select>
                    </div>
                    <div>
                      <label>Área</label>
                      <select value={formData.area_id} onChange={e => setFormData({...formData, area_id: e.target.value})} style={{width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)'}}>
                        <option value="">Sin restricción de área</option>
                        {areas.filter(a => a.activo).map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <label>Modalidad</label>
                <select value={formData.modalidad} onChange={e => setFormData({...formData, modalidad: e.target.value})} style={{width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1rem'}}>
                  <option value="presencial">Presencial</option>
                  <option value="virtual">Virtual</option>
                  <option value="mixta">Mixta</option>
                </select>

                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem'}}>
                  <div>
                    <label>Duración (horas)</label>
                    <input type="number" required min="1" value={formData.duracion_horas} onChange={e => setFormData({...formData, duracion_horas: e.target.value})} />
                  </div>
                  <div>
                    <label>Vigencia (meses)</label>
                    <input type="number" required min="1" value={formData.meses_vigencia} onChange={e => setFormData({...formData, meses_vigencia: e.target.value})} />
                  </div>
                </div>

                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem'}}>
                  <div>
                    <label>Evaluación</label>
                    <select value={formData.requiere_evaluacion} onChange={e => setFormData({...formData, requiere_evaluacion: e.target.value === 'true'})}>
                      <option value="true">Sí</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                  <div>
                    <label>Puntaje Total</label>
                    <input type="number" step="0.5" min="1" value={formData.puntaje_total} onChange={e => setFormData({...formData, puntaje_total: e.target.value})} />
                  </div>
                  <div>
                    <label>Aprobación</label>
                    <input type="number" step="0.5" min="0" value={formData.puntaje_aprobacion} onChange={e => setFormData({...formData, puntaje_aprobacion: e.target.value})} />
                  </div>
                </div>

                <div style={{display: 'flex', gap: '1rem', marginTop: '1rem'}}>
                  <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-success">Guardar Curso</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{padding: 0, overflow: 'hidden'}}>
        <table style={{width: '100%', borderCollapse: 'collapse', textAlign: 'left'}}>
          <thead style={{background: '#f8fafc', borderBottom: '1px solid var(--border-color)'}}>
            <tr>
              <th style={{padding: '1rem'}}>Nombre del Curso</th>
              <th style={{padding: '1rem'}}>Rubro</th>
              <th style={{padding: '1rem'}}>Área</th>
              <th style={{padding: '1rem'}}>Modalidad</th>
              <th style={{padding: '1rem'}}>Vigencia</th>
              <th style={{padding: '1rem'}}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {capacitaciones.map(c => (
              <tr 
                key={c.id} 
                className="clickable-row"
                onClick={() => navigate(`/admin/capacitaciones/${c.id}`)}
                style={{borderBottom: '1px solid var(--border-color)'}}
              >
                <td style={{padding: '1rem', fontWeight: 500}}>{c.nombre}</td>
                <td style={{padding: '1rem'}}>
                  {c.rubro_nombre ? <span className="badge badge-info" style={{background: '#e0f2fe', color: '#0369a1'}}>{c.rubro_nombre}</span> : <span style={{color: 'var(--text-light)', fontSize: '0.85rem'}}>—</span>}
                </td>
                <td style={{padding: '1rem'}}>
                  {c.area_nombre ? <span className="badge badge-info" style={{background: '#f0fdf4', color: '#166534'}}>{c.area_nombre}</span> : <span style={{color: 'var(--text-light)', fontSize: '0.85rem'}}>—</span>}
                </td>
                <td style={{padding: '1rem'}}>{modalidadLabel(c.modalidad)}</td>
                <td style={{padding: '1rem'}}>{c.meses_vigencia} meses</td>
                <td style={{padding: '1rem'}} onClick={e => e.stopPropagation()}>
                  <Link to={`/admin/capacitaciones/${c.id}`} className="btn" style={{background: '#eee', textDecoration: 'none'}}>Administrar</Link>
                </td>
              </tr>
            ))}
            {capacitaciones.length === 0 && (
              <tr><td colSpan="6" style={{padding: '2rem', textAlign: 'center', color: 'var(--text-light)'}}>No hay cursos en el catálogo</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
