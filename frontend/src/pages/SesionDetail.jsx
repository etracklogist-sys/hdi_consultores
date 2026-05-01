import React, { useEffect, useState } from 'react';
import { authFetch } from '../utils/apiClient';
import { useParams, Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export default function SesionDetail() {
  const { id } = useParams();
  const [sesion, setSesion] = useState(null);
  const [participantes, setParticipantes] = useState([]);
  const [error, setError] = useState(null);

  const loadData = async () => {
    try {
      const res = await authFetch(`${API_URL}/sesiones/${id}`);
      if (!res.ok) { 
        const text = await res.text(); 
        throw new Error(`HTTP ${res.status}: ${text}`); 
      }
      const data = await res.json();
      setSesion(data.header);
      setParticipantes(data.participantes);
    } catch (err) {
      setError(err.message);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const getStatusBadge = (estado) => {
    switch(estado) {
        case 'programada': return 'badge-warning';
        case 'en_curso': return 'badge-primary';
        case 'finalizada': return 'badge-success';
        case 'cancelada': return 'badge-danger';
        default: return 'badge-light';
    }
  };

  const handleUpdateStatus = async (newStatus) => {
      try {
        const res = await authFetch(`${API_URL}/sesiones/${id}/estado`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ estado_sesion: newStatus })
        });
        if (!res.ok) throw new Error("Error actualizando estado");
        await loadData();
      } catch (err) {
        alert("Error actualizando estado");
      }
  };

  const handleParticipantChange = async (partId, field, value) => {
      const p = participantes.find(x => x.id === partId);
      const payload = {
          asistio: p.asistio,
          estado_participacion: p.estado_participacion,
          nota: p.nota,
          aprobado: p.aprobado,
          observaciones: p.observaciones
      };
      
      payload[field] = value;
      
      if (field === 'asistio' && value === true) payload.estado_participacion = 'asistio';
      if (field === 'asistio' && value === false) payload.estado_participacion = 'ausente';
      if (field === 'aprobado' && value === true) payload.estado_participacion = 'aprobado';
      if (field === 'aprobado' && value === false) payload.estado_participacion = 'desaprobado';

      try {
        const res = await authFetch(`${API_URL}/sesiones/${id}/participantes/${partId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.detail || "Error actualizando participante (HTTP " + res.status + ")");
        }
        await loadData();
      } catch (err) {
        alert(err.message);
      }
  };

  if (error) return <div style={{color: 'var(--accent-red)', padding: '2rem'}}>{error}</div>;
  if (!sesion) return <div style={{padding: '2rem'}}>Cargando sesión...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', alignItems: 'flex-start' }}>
        <div>
          <Link to="/admin/sesiones" style={{color: 'var(--text-light)', textDecoration: 'none', marginBottom: '0.5rem', display: 'inline-block'}}>← Volver a Sesiones Operativas</Link>
          <h2 style={{margin: '0.5rem 0 0.5rem 0'}}>{sesion.titulo || `Sesión de ${sesion.capacitacion_nombre}`}</h2>
          <p style={{margin: 0, color: 'var(--text-light)'}}>Cliente: <span style={{fontWeight: 'bold', color: 'var(--text-dark)'}}>{sesion.cliente_nombre}</span></p>
        </div>
        <div style={{textAlign: 'right'}}>
          <span className={`badge ${getStatusBadge(sesion.estado)}`} style={{fontSize: '1rem', display: 'block', marginBottom: '1rem'}}>
            {sesion.estado.replace('_', ' ').toUpperCase()}
          </span>
          <select 
            className="btn" 
            style={{background: '#fff', border: '1px solid var(--border-color)'}}
            value={sesion.estado} 
            onChange={(e) => handleUpdateStatus(e.target.value)}
          >
              <option value="programada">Marcar como Programada</option>
              <option value="en_curso">Marcar como En Curso</option>
              <option value="finalizada">Marcar como Finalizada</option>
              <option value="cancelada">Marcar como Cancelada</option>
          </select>
        </div>
      </div>

      <div style={{display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '2rem'}}>
        <div className="card" style={{padding: '1rem'}}>
          <p style={{margin: '0 0 0.25rem 0', color: 'var(--text-light)', fontSize: '0.85rem'}}>Fecha Programada</p>
          <p style={{margin: 0, fontWeight: 500}}>{sesion.fecha} {sesion.hora && `(${sesion.hora})`}</p>
        </div>
        <div className="card" style={{padding: '1rem'}}>
          <p style={{margin: '0 0 0.25rem 0', color: 'var(--text-light)', fontSize: '0.85rem'}}>Responsable / Capacitador</p>
          <p style={{margin: 0, fontWeight: 500}}>{sesion.capacitador || 'No definido'}</p>
        </div>
        <div className="card" style={{padding: '1rem'}}>
          <p style={{margin: '0 0 0.25rem 0', color: 'var(--text-light)', fontSize: '0.85rem'}}>Modalidad</p>
          <p style={{margin: 0, fontWeight: 500, textTransform: 'capitalize'}}>{sesion.modalidad}</p>
        </div>
        <div className="card" style={{padding: '1rem', gridColumn: 'span 2'}}>
          <p style={{margin: '0 0 0.25rem 0', color: 'var(--text-light)', fontSize: '0.85rem'}}>Ubicación / Link</p>
          <p style={{margin: 0, fontWeight: 500}}>{sesion.ubicacion || 'No definido'}</p>
        </div>
      </div>

      <div className="card" style={{padding: 0, overflow: 'x-auto', minHeight: '400px'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', background: '#f8fafc', borderBottom: '1px solid var(--border-color)'}}>
          <h3 style={{margin: 0}}>Participantes de la sesión</h3>
          <span style={{color: 'var(--text-light)', fontSize: '0.85rem'}}>{participantes.length} empleados autoconvocados</span>
        </div>
        
        <table style={{width: '100%', borderCollapse: 'collapse', textAlign: 'left'}}>
          <thead style={{borderBottom: '1px solid var(--border-color)'}}>
            <tr>
              <th style={{padding: '1rem'}}>Empleado</th>
              <th style={{padding: '1rem'}}>Área Operativa</th>
              <th style={{padding: '1rem', textAlign: 'center'}}>Asistió</th>
              <th style={{padding: '1rem', textAlign: 'center'}}>Estado Evento</th>
              <th style={{padding: '1rem', textAlign: 'center'}}>Aprobado</th>
              <th style={{padding: '1rem', width: '80px', textAlign: 'center'}}>Nota</th>
            </tr>
          </thead>
          <tbody>
            {participantes.length > 0 ? participantes.map(p => (
              <tr key={p.id} style={{borderBottom: '1px solid var(--border-color)'}}>
                <td style={{padding: '1rem', fontWeight: 500}}>{p.nombre_empleado}</td>
                <td style={{padding: '1rem', color: 'var(--text-light)'}}>{p.area}</td>
                <td style={{padding: '1rem', textAlign: 'center'}}>
                    <input 
                        type="checkbox" 
                        checked={p.asistio} 
                        onChange={(e) => handleParticipantChange(p.id, 'asistio', e.target.checked)}
                        style={{width: '1.25rem', height: '1.25rem', cursor: 'pointer', accentColor: 'var(--primary-color)'}}
                    />
                </td>
                <td style={{padding: '1rem', textAlign: 'center', textTransform: 'capitalize'}}>
                    <span style={{
                        padding: '0.25rem 0.5rem', 
                        borderRadius: '4px', 
                        fontSize: '0.85rem', 
                        fontWeight: 'bold',
                        color: p.estado_participacion === 'ausente' ? 'var(--accent-red)' : 
                               p.estado_participacion === 'convocado' ? 'var(--text-light)' : 'var(--primary-color)',
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0'
                    }}>
                        {p.estado_participacion}
                    </span>
                </td>
                <td style={{padding: '1rem', textAlign: 'center'}}>
                    <select 
                        value={p.aprobado === null ? "" : (p.aprobado ? "true" : "false")}
                        onChange={(e) => {
                            const val = e.target.value === "" ? null : e.target.value === "true";
                            handleParticipantChange(p.id, 'aprobado', val);
                        }}
                        style={{padding: '0.35rem', borderRadius: '4px', border: '1px solid var(--border-color)', opacity: !p.asistio ? 0.5 : 1}}
                        disabled={!p.asistio}
                    >
                        <option value="">-</option>
                        <option value="true">Sí</option>
                        <option value="false">No</option>
                    </select>
                </td>
                <td style={{padding: '1rem', textAlign: 'center'}}>
                    <input 
                        type="number" 
                        min="0" max="100" 
                        placeholder="--"
                        value={p.nota === null ? "" : p.nota}
                        onChange={(e) => {
                            const inputVal = e.target.value;
                            if (inputVal === "") {
                                handleParticipantChange(p.id, 'nota', null);
                            }
                        }}
                        onBlur={(e) => {
                            const inputVal = e.target.value;
                            if (inputVal !== "") {
                                handleParticipantChange(p.id, 'nota', parseFloat(inputVal));
                            }
                        }}
                        disabled={!p.asistio}
                        style={{width: '60px', padding: '0.35rem', borderRadius: '4px', border: '1px solid var(--border-color)', textAlign: 'center', opacity: !p.asistio ? 0.5 : 1}}
                    />
                </td>
              </tr>
            )) : (
                <tr>
                    <td colSpan="6" style={{padding: '2rem', textAlign: 'center', color: 'var(--text-light)'}}>
                        No se detectaron empleados candidatos autoconvocables.
                        <br/><span style={{fontSize: '0.85rem'}}>Asegúrese de que el cliente tenga asignada la respectiva capacitación, y que los empleados involucrados estén vigentes.</span>
                    </td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
