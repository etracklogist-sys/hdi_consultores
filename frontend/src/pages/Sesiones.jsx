import React, { useEffect, useState } from 'react';
import { authFetch } from '../utils/apiClient';
import { Link, useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export default function Sesiones() {
  const [sesiones, setSesiones] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [capacitaciones, setCapacitaciones] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    cliente_id: '',
    capacitacion_id: '',
    titulo_sesion: '',
    fecha_programada: '',
    hora_programada: '',
    modalidad: 'presencial',
    ubicacion: '',
    capacitador: '',
    observaciones: ''
  });

  const fetchData = async () => {
    try {
      const resSesiones = await authFetch(`${API_URL}/sesiones/`);
      if (resSesiones.ok) setSesiones(await resSesiones.json());
      const resClientes = await authFetch(`${API_URL}/clientes/`);
      if (resClientes.ok) {
        const data = await resClientes.json();
        setClientes(data.filter(c => c.activo));
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isModalOpen]);

  // When client changes, we ideally want to fetch ONLY the trainings that are assigned to them.
  // We can fetch from `/clientes/{id}/asignaciones`
  useEffect(() => {
    const fetchAsignaciones = async () => {
      try {
        if (formData.cliente_id) {
          const res = await authFetch(`${API_URL}/clientes/${formData.cliente_id}/asignaciones`);
          if (!res.ok) throw new Error("Error fetching asignaciones");
          const data = await res.json();
          const uniqueCaps = [];
          const idsObj = {};
          data.forEach(d => {
              if(!idsObj[d.capacitacion_id]) {
                  idsObj[d.capacitacion_id] = true;
                  uniqueCaps.push({ id: d.capacitacion_id, nombre: d.titulo });
              }
          });
          setCapacitaciones(uniqueCaps);
        } else {
          setCapacitaciones([]);
        }
      } catch (e) {
        console.error(e);
        setCapacitaciones([]);
      }
    };
    fetchAsignaciones();
  }, [formData.cliente_id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const payload = {
        cliente_id: parseInt(formData.cliente_id),
        capacitacion_id: parseInt(formData.capacitacion_id),
        titulo_sesion: formData.titulo_sesion || null,
        fecha_programada: formData.fecha_programada + "T00:00:00Z",
        hora_programada: formData.hora_programada || null,
        modalidad: formData.modalidad,
        ubicacion: formData.ubicacion || null,
        capacitador: formData.capacitador || null,
        observaciones: formData.observaciones || null
    };

    try {
      const res = await authFetch(`${API_URL}/sesiones/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Error agendando la sesión.");
      }
      const data = await res.json();
      setIsModalOpen(false);
      navigate(`/admin/sesiones/${data.sesion_id}`);
    } catch (err) {
      alert(err.message);
    }
  };

  const getStatusBadge = (estado) => {
      switch(estado) {
          case 'programada': return 'badge-warning';
          case 'en_curso': return 'badge-primary';
          case 'finalizada': return 'badge-success';
          case 'cancelada': return 'badge-danger';
          default: return 'badge-light';
      }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
            <h2 style={{margin: 0}}>Sesiones Operativas</h2>
            <p style={{margin: '0.25rem 0 0 0', color: 'var(--text-light)', fontSize: '0.9rem'}}>Convierte las asignaciones de capacitación en eventos ejecutables.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>+ Nueva sesión</button>
      </div>

      {isModalOpen && (
        <div className="modal-overlay" style={{ overflow: 'hidden' }}>
          <div className="modal-content" style={{ maxWidth: '600px', width: '100%', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0 }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
                <h3 style={{ margin: 0 }}>Programar Sesión</h3>
            </div>
            
            <div style={{ padding: '1.5rem', overflowY: 'auto', flex: 1 }}>
              <form id="sesion-form" onSubmit={handleSubmit}>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                        <label style={{display: 'block', marginBottom: '0.25rem', fontWeight: 500}}>Cliente</label>
                        <select required value={formData.cliente_id} onChange={e => setFormData({...formData, cliente_id: e.target.value, capacitacion_id: ''})} style={{width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)'}}>
                          <option value="">-- Selecciona Cliente --</option>
                          {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
                        </select>
                    </div>
                    <div>
                        <label style={{display: 'block', marginBottom: '0.25rem', fontWeight: 500}}>Capacitación (Asignadas)</label>
                        <select required value={formData.capacitacion_id} onChange={e => setFormData({...formData, capacitacion_id: e.target.value})} style={{width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)'}} disabled={!formData.cliente_id}>
                          <option value="">-- Selecciona Capacitación --</option>
                          {capacitaciones.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                        </select>
                    </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                    <label style={{display: 'block', marginBottom: '0.25rem', fontWeight: 500}}>Título de la sesión (Opcional)</label>
                    <input type="text" placeholder="Ej: Inducción de Seguridad - Planta Norte" value={formData.titulo_sesion} onChange={e => setFormData({...formData, titulo_sesion: e.target.value})} style={{width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)'}} />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                        <label style={{display: 'block', marginBottom: '0.25rem', fontWeight: 500}}>Fecha programada</label>
                        <input type="date" required value={formData.fecha_programada} onChange={e => setFormData({...formData, fecha_programada: e.target.value})} style={{width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)'}} />
                    </div>
                    <div>
                        <label style={{display: 'block', marginBottom: '0.25rem', fontWeight: 500}}>Hora (Opcional)</label>
                        <input type="time" value={formData.hora_programada} onChange={e => setFormData({...formData, hora_programada: e.target.value})} style={{width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)'}} />
                    </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                        <label style={{display: 'block', marginBottom: '0.25rem', fontWeight: 500}}>Modalidad</label>
                        <select required value={formData.modalidad} onChange={e => setFormData({...formData, modalidad: e.target.value})} style={{width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)'}}>
                          <option value="presencial">Presencial</option>
                          <option value="virtual">Virtual</option>
                          <option value="mixta">Mixta</option>
                        </select>
                    </div>
                    <div>
                        <label style={{display: 'block', marginBottom: '0.25rem', fontWeight: 500}}>Ubicación / Link (Opcional)</label>
                        <input type="text" value={formData.ubicacion} onChange={e => setFormData({...formData, ubicacion: e.target.value})} style={{width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)'}} />
                    </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                    <label style={{display: 'block', marginBottom: '0.25rem', fontWeight: 500}}>Capacitador (Opcional)</label>
                    <input type="text" value={formData.capacitador} onChange={e => setFormData({...formData, capacitador: e.target.value})} style={{width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)'}} />
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{display: 'block', marginBottom: '0.25rem', fontWeight: 500}}>Observaciones (Opcional)</label>
                    <textarea rows="2" value={formData.observaciones} onChange={e => setFormData({...formData, observaciones: e.target.value})} style={{width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)'}}></textarea>
                </div>

              </form>
            </div>
            
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '1rem', justifyContent: 'flex-end', background: '#fff', borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px' }}>
              <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Cancelar</button>
              <button type="submit" form="sesion-form" className="btn btn-primary">Guardar y Listar Convencados</button>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{padding: 0, overflow: 'hidden'}}>
        <table style={{width: '100%', borderCollapse: 'collapse', textAlign: 'left'}}>
          <thead style={{background: '#f8fafc', borderBottom: '1px solid var(--border-color)'}}>
            <tr>
              <th style={{padding: '1rem'}}>Fecha</th>
              <th style={{padding: '1rem'}}>Cliente</th>
              <th style={{padding: '1rem'}}>Capacitación</th>
              <th style={{padding: '1rem'}}>Modalidad</th>
              <th style={{padding: '1rem'}}>Estado</th>
              <th style={{padding: '1rem'}}>Participantes</th>
              <th style={{padding: '1rem'}}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {sesiones.length > 0 ? sesiones.map(c => (
              <tr 
                key={c.id} 
                className="clickable-row"
                onClick={() => navigate(`/admin/sesiones/${c.id}`)}
                style={{borderBottom: '1px solid var(--border-color)'}}
              >
                <td style={{padding: '1rem', fontWeight: 500}}>{c.fecha} {c.hora && <span style={{color: 'var(--text-light)', fontSize: '0.85rem'}}>({c.hora})</span>}</td>
                <td style={{padding: '1rem'}}>{c.cliente_nombre}</td>
                <td style={{padding: '1rem'}}>{c.capacitacion_nombre}</td>
                <td style={{padding: '1rem', textTransform: 'capitalize'}}>{c.modalidad}</td>
                <td style={{padding: '1rem'}}>
                  <span className={`badge ${getStatusBadge(c.estado)}`}>
                    {c.estado.replace('_', ' ').toUpperCase()}
                  </span>
                </td>
                <td style={{padding: '1rem', textAlign: 'center'}}>{c.participantes_count}</td>
                <td style={{padding: '1rem'}} onClick={e => e.stopPropagation()}>
                  <Link to={`/admin/sesiones/${c.id}`} className="btn btn-primary" style={{textDecoration: 'none', padding: '0.5rem 1rem'}}>Ver sesión</Link>
                </td>
              </tr>
            )) : (
                <tr>
                    <td colSpan="7" style={{padding: '2rem', textAlign: 'center', color: 'var(--text-light)'}}>
                        No hay sesiones operativas programadas.
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
