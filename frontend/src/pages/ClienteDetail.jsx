import React, { useEffect, useState } from 'react';
import { authFetch } from '../utils/apiClient';
import { Link, useParams, useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const estadoBadge = (estado) => {
  const map = {
    pendiente: { label: 'Pendiente', bg: '#fef3c7', color: '#92400e' },
    en_curso: { label: 'En curso', bg: '#dbeafe', color: '#1e40af' },
    aprobado: { label: 'Aprobado', bg: '#dcfce7', color: '#166534' },
    desaprobado: { label: 'Desaprobado', bg: '#fee2e2', color: '#991b1b' }
  };
  const s = map[estado] || { label: estado, bg: '#f1f5f9', color: '#64748b' };
  return <span style={{padding: '0.15rem 0.5rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 600, background: s.bg, color: s.color}}>{s.label}</span>;
};

export default function ClienteDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Employee creation modal
  const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);
  const [empForm, setEmpForm] = useState({ nombre_completo: '', email: '', dni: '' });
  const [empError, setEmpError] = useState(null);

  // Client edit modal
  const [isClientEditModalOpen, setIsClientEditModalOpen] = useState(false);
  const [clientEditForm, setClientEditForm] = useState({ razon_social: '', cuit: '', rubro_id: '', area_ids: [], activo: true });
  const [rubros, setRubros] = useState([]);
  const [areasList, setAreasList] = useState([]);

  // Client delete/archive modal
  const [deleteModal, setDeleteModal] = useState({ show: false, mode: 'none' }); // mode: 'delete' | 'archive'
  const [isDeleting, setIsDeleting] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [resCli, resDash] = await Promise.all([
        authFetch(`${API_URL}/clientes/${id}`),
        authFetch(`${API_URL}/clientes/${id}/dashboard`)
      ]);
      if (!resCli.ok) throw new Error(`Error cargando cliente: ${await resCli.text()}`);
      setCliente(await resCli.json());
      if (resDash.ok) setDashboard(await resDash.json());

      const [resRub, resAreas] = await Promise.all([
        authFetch(`${API_URL}/rubros/`).catch(() => ({ json: () => [] })),
        authFetch(`${API_URL}/areas/`).catch(() => ({ json: () => [] }))
      ]);
      setRubros(await resRub.json());
      setAreasList(await resAreas.json());
      setError(null);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadAll(); }, [id]);

  const handleCreateEmpleado = async (e) => {
    e.preventDefault();
    setEmpError(null);
    try {
      const res = await authFetch(`${API_URL}/empleados/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre_completo: empForm.nombre_completo, email: empForm.email || null, dni: empForm.dni || null, cliente_id: parseInt(id), activo: true, area_id: null })
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail || 'Error al crear empleado'); }
      setIsEmpModalOpen(false);
      setEmpForm({ nombre_completo: '', email: '', dni: '' });
      loadAll();
    } catch (err) { setEmpError(err.message); }
  };

  const handleClientUpdate = async (e) => {
    e.preventDefault();
    try {
      const res = await authFetch(`${API_URL}/clientes/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ razon_social: clientEditForm.razon_social, cuit: clientEditForm.cuit, rubro_id: clientEditForm.rubro_id ? parseInt(clientEditForm.rubro_id) : null, area_ids: clientEditForm.area_ids, activo: clientEditForm.activo })
      });
      if (!res.ok) throw new Error(`Error: ${await res.text()}`);
      setIsClientEditModalOpen(false);
      loadAll();
    } catch(err) { alert(err.message); }
  };

  const handleDestructiveAction = async () => {
    setIsDeleting(true);
    try {
      if (deleteModal.mode === 'delete') {
        const res = await authFetch(`${API_URL}/clientes/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(await res.text());
        navigate('/admin/clientes');
      } else if (deleteModal.mode === 'archive') {
        const res = await authFetch(`${API_URL}/clientes/${id}/archivar`, { method: 'PATCH' });
        if (!res.ok) throw new Error(await res.text());
        setDeleteModal({ show: false, mode: 'none' });
        loadAll(); // Reload to reflect changes
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
      setDeleteModal({ show: false, mode: 'none' });
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) return <div style={{padding: '2rem'}}>Cargando ficha de cliente...</div>;
  if (error) return <div style={{color: '#c00', padding: '2rem'}}>{error}</div>;
  if (!cliente) return <div style={{padding: '2rem'}}>Cliente no encontrado</div>;

  const kpis = dashboard?.kpis || {};
  const programadas = dashboard?.programadas || [];
  const empleados = dashboard?.empleados_status || [];
  const yearSummary = dashboard?.year_summary || {};

  const KpiCard = ({ label, value, color, sub }) => (
    <div className="card" style={{textAlign: 'center', padding: '1rem'}}>
      <div style={{fontSize: '0.75rem', color: 'var(--text-light)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.3rem'}}>{label}</div>
      <div style={{fontSize: '1.8rem', fontWeight: 700, color: color || 'var(--text-main)', lineHeight: 1.1}}>{value}</div>
      {sub && <div style={{fontSize: '0.75rem', color: 'var(--text-light)', marginTop: '0.2rem'}}>{sub}</div>}
    </div>
  );

  const ProgressBar = ({ current, total, color }) => (
    <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
      <div style={{flex: 1, height: '8px', background: '#e2e8f0', borderRadius: '4px', overflow: 'hidden'}}>
        <div style={{width: total > 0 ? `${Math.min((current/total)*100, 100)}%` : '0%', height: '100%', background: color || 'var(--primary-color)', borderRadius: '4px', transition: 'width 0.5s ease'}} />
      </div>
      <span style={{fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap', minWidth: '60px', textAlign: 'right'}}>{current}/{total}</span>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', alignItems: 'center' }}>
        <div>
          <Link to="/admin/clientes" style={{color: 'var(--text-light)', textDecoration: 'none', marginBottom: '0.5rem', display: 'inline-block'}}>← Directorio de Clientes</Link>
          <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
            <h2 style={{margin: 0}}>{cliente.razon_social}</h2>
            <button className="btn btn-outline" style={{padding: '0.3rem 0.6rem', fontSize: '0.85rem'}} onClick={() => {
              setClientEditForm({ razon_social: cliente.razon_social, cuit: cliente.cuit, rubro_id: cliente.rubro_id, area_ids: cliente.areas?.map(a => a.id) || [], activo: cliente.activo });
              setIsClientEditModalOpen(true);
            }}>⚙️ Editar</button>
            {cliente.can_delete && (
              <button 
                className="btn" 
                style={{padding: '0.3rem 0.6rem', fontSize: '0.85rem', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5'}}
                onClick={() => setDeleteModal({ show: true, mode: 'delete' })}
              >
                🗑️ Eliminar
              </button>
            )}
            {!cliente.can_delete && cliente.can_archive && cliente.activo && (
              <button 
                className="btn" 
                style={{padding: '0.3rem 0.6rem', fontSize: '0.85rem', background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d'}}
                onClick={() => setDeleteModal({ show: true, mode: 'archive' })}
              >
                📦 Archivar
              </button>
            )}
          </div>
          <p style={{color: 'var(--text-light)', margin: '0.5rem 0 0'}}>
            CUIT: <strong>{cliente.cuit}</strong> · Rubro: <strong>{cliente.rubro_nombre || 'Sin asignar'}</strong>
          </p>
        </div>
        <div style={{display: 'flex', gap: '0.75rem', alignItems: 'center'}}>
          <span className={`badge ${cliente.activo ? 'badge-success' : 'badge-danger'}`} style={{fontSize: '0.95rem'}}>
            {cliente.activo ? 'Vigente' : 'Inactivo'}
          </span>
          <button className="btn btn-primary" onClick={() => navigate(`/admin/plan-anual/${id}`)}>🗓️ Plan Anual</button>
        </div>
      </div>

      {/* ═══ KPIs ═══ */}
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '2rem'}}>
        <KpiCard label="Cap. Activas" value={kpis.capacitaciones_activas || 0} color="var(--primary-color)" sub={`de ${yearSummary.total || 0} en el año`} />
        <KpiCard label="Empleados en Cap." value={kpis.empleados_con_capacitacion || 0} color="#0d9488" sub={`de ${kpis.empleados_activos || 0} activos`} />
        <KpiCard label="% Aprobados" value={`${kpis.pct_aprobados || 0}%`} color="#16a34a" sub={`${kpis.aprobados || 0} de ${kpis.total_asignaciones || 0}`} />
        <KpiCard label="% Desaprobados" value={`${kpis.pct_desaprobados || 0}%`} color="#dc2626" sub={`${kpis.desaprobados || 0} de ${kpis.total_asignaciones || 0}`} />
        <KpiCard label="Pendientes" value={kpis.pendientes || 0} color="#d97706" sub={kpis.en_curso ? `${kpis.en_curso} en curso` : ''} />
      </div>

      {/* ═══ Year Summary Bar ═══ */}
      <div className="card" style={{marginBottom: '2rem', padding: '0.75rem 1.25rem'}}>
        <div style={{display: 'flex', alignItems: 'center', gap: '1.5rem', fontSize: '0.85rem'}}>
          <span style={{fontWeight: 600, color: 'var(--text-light)'}}>Resumen {dashboard?.anio || new Date().getFullYear()}:</span>
          <span>🟢 {yearSummary.activas || 0} activas</span>
          <span>🟡 {yearSummary.programadas || 0} pendientes</span>
          <span>✓ {yearSummary.finalizadas || 0} finalizadas</span>
          <span>✕ {yearSummary.canceladas || 0} canceladas</span>
        </div>
      </div>

      {/* ═══ Capacitaciones del Período (operational) ═══ */}
      <div className="card" style={{padding: 0, overflow: 'hidden', marginBottom: '2rem'}}>
        <div style={{padding: '1rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <div>
            <h3 style={{margin: 0, fontSize: '1rem'}}>⚡ Instancias del período</h3>
            <p style={{margin: '0.15rem 0 0', fontSize: '0.78rem', color: 'var(--text-light)'}}>Instancias activas y programadas — estado operativo real</p>
          </div>
        </div>
        {programadas.length > 0 ? (
          <table style={{width: '100%', borderCollapse: 'collapse'}}>
            <thead><tr style={{borderBottom: '2px solid var(--border-color)', background: '#fafbfc'}}>
              <th style={{padding: '0.6rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-light)'}}>Nombre</th>
              <th style={{padding: '0.6rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-light)'}}>Tipo</th>
              <th style={{padding: '0.6rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-light)'}}>Mes</th>
              <th style={{padding: '0.6rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-light)'}}>Año</th>
              <th style={{padding: '0.6rem 1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-light)'}}>Estado</th>
              <th style={{padding: '0.6rem 1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-light)'}}>Asignados</th>
              <th style={{padding: '0.6rem 1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-light)'}}>En curso</th>
              <th style={{padding: '0.6rem 1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-light)'}}>Aprobados</th>
              <th style={{padding: '0.6rem 1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-light)'}}>Desaprobados</th>
              <th style={{padding: '0.6rem 1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-light)'}}>Pendientes</th>
              <th style={{padding: '0.6rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-light)', minWidth: '150px'}}>Avance</th>
            </tr></thead>
            <tbody>
              {programadas.map(p => (
                <tr key={p.id} style={{borderBottom: '1px solid var(--border-color)', background: p.estado === 'PROGRAMADA' ? '#fffbeb' : 'transparent'}}>
                  <td style={{padding: '0.75rem 1rem'}}>
                    <div style={{fontWeight: 600, fontSize: '0.9rem'}}>{p.nombre}</div>
                    <div style={{fontSize: '0.75rem', color: 'var(--text-light)'}}>{p.modalidad}</div>
                  </td>
                  <td style={{padding: '0.75rem 1rem', fontSize: '0.85rem'}}>{p.tipo}</td>
                  <td style={{padding: '0.75rem 1rem', fontSize: '0.85rem'}}>{MESES[p.mes - 1]}</td>
                  <td style={{padding: '0.75rem 1rem', fontSize: '0.85rem'}}>{dashboard?.anio || new Date().getFullYear()}</td>
                  <td style={{padding: '0.75rem', textAlign: 'center'}}>
                    {p.estado === 'ACTIVA' ? (
                      <span style={{padding: '0.15rem 0.5rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 600, background: '#dcfce7', color: '#166534'}}>Activa</span>
                    ) : (
                      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.15rem'}}>
                        <span style={{padding: '0.15rem 0.5rem', borderRadius: '10px', fontSize: '0.75rem', fontWeight: 600, background: '#fef3c7', color: '#92400e'}}>Programada</span>
                        <span style={{fontSize: '0.65rem', color: '#92400e', fontStyle: 'italic'}}>Pendiente de activación</span>
                      </div>
                    )}
                  </td>
                  <td style={{padding: '0.75rem', textAlign: 'center', fontWeight: 600}}>{p.total_asignados}</td>
                  <td style={{padding: '0.75rem', textAlign: 'center', color: '#2563eb', fontWeight: 600}}>{p.en_curso}</td>
                  <td style={{padding: '0.75rem', textAlign: 'center', color: '#16a34a', fontWeight: 600}}>{p.aprobados}</td>
                  <td style={{padding: '0.75rem', textAlign: 'center', color: '#dc2626', fontWeight: 600}}>{p.desaprobados}</td>
                  <td style={{padding: '0.75rem', textAlign: 'center', color: '#d97706', fontWeight: 600}}>{p.pendientes}</td>
                  <td style={{padding: '0.75rem'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
                      <ProgressBar current={p.aprobados + p.desaprobados} total={p.total_asignados} color={p.porcentaje_avance >= 80 ? '#16a34a' : p.porcentaje_avance >= 40 ? '#f59e0b' : '#e2e8f0'} />
                      <span style={{fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-light)', minWidth: '35px'}}>{p.porcentaje_avance}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{padding: '2.5rem', textAlign: 'center', color: '#94a3b8'}}>
            <div style={{fontSize: '1.5rem', marginBottom: '0.5rem'}}>📋</div>
            <p style={{margin: 0}}>No hay capacitaciones activas ni programadas para este cliente.</p>
            <p style={{margin: '0.5rem 0 0', fontSize: '0.85rem'}}>
              Configurá el Plan Anual para generar instancias de ejecución.
            </p>
          </div>
        )}
      </div>

      {/* ═══ Employee Status (real operational) ═══ */}
      <div className="card" style={{padding: 0, overflow: 'hidden', marginBottom: '2rem'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid var(--border-color)'}}>
          <div>
            <h3 style={{margin: 0, fontSize: '1rem'}}>👥 Estado de Empleados</h3>
            <p style={{margin: '0.15rem 0 0', fontSize: '0.78rem', color: 'var(--text-light)'}}>Progreso individual en capacitaciones activas</p>
          </div>
          <button className="btn btn-primary" style={{padding: '0.35rem 0.75rem', fontSize: '0.85rem'}} onClick={() => { setEmpError(null); setEmpForm({ nombre_completo: '', email: '', dni: '' }); setIsEmpModalOpen(true); }}>+ Agregar Empleado</button>
        </div>
        {empleados.length > 0 ? (
          <table style={{width: '100%', borderCollapse: 'collapse'}}>
            <thead><tr style={{borderBottom: '2px solid var(--border-color)', background: '#fafbfc'}}>
              <th style={{padding: '0.6rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-light)'}}>Empleado</th>
              <th style={{padding: '0.6rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-light)'}}>DNI</th>
              <th style={{padding: '0.6rem 1rem', textAlign: 'left', fontSize: '0.8rem', color: 'var(--text-light)'}}>Instancia operativa</th>
              <th style={{padding: '0.6rem 1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-light)'}}>Estado</th>
            </tr></thead>
            <tbody>
              {empleados.map((e, i) => (
                <tr key={i} style={{borderBottom: '1px solid #f1f5f9'}}>
                  <td style={{padding: '0.6rem 1rem', fontWeight: 500, fontSize: '0.9rem'}}>{e.nombre}</td>
                  <td style={{padding: '0.6rem 1rem', color: 'var(--text-light)', fontSize: '0.85rem'}}>{e.dni || '—'}</td>
                  <td style={{padding: '0.6rem 1rem', fontSize: '0.85rem'}}>{e.capacitacion}</td>
                  <td style={{padding: '0.6rem 1rem', textAlign: 'center'}}>{estadoBadge(e.estado)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{padding: '2rem', textAlign: 'center', color: '#94a3b8'}}>
            {kpis.capacitaciones_activas > 0
              ? 'No hay asignaciones de empleados en capacitaciones activas.'
              : 'Las asignaciones se generan automáticamente al activarse las capacitaciones.'
            }
          </div>
        )}
      </div>

      {/* ═══ Quick Info ═══ */}
      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem'}}>
        <div className="card">
          <h4 style={{marginTop: 0, color: 'var(--text-light)', fontSize: '0.8rem', textTransform: 'uppercase'}}>Áreas Asociadas</h4>
          <div style={{display: 'flex', gap: '0.35rem', flexWrap: 'wrap'}}>
            {cliente.areas && cliente.areas.length > 0 ? cliente.areas.map(a => (
              <span key={a.id} style={{padding: '0.2rem 0.5rem', borderRadius: '4px', background: 'var(--secondary-color)', color: '#fff', fontSize: '0.8rem'}}>{a.nombre}</span>
            )) : <span style={{color: 'var(--text-light)'}}>Sin áreas</span>}
          </div>
        </div>
        <div className="card">
          <h4 style={{marginTop: 0, color: 'var(--text-light)', fontSize: '0.8rem', textTransform: 'uppercase'}}>Empleados</h4>
          <p style={{fontSize: '1.1rem', fontWeight: 600, margin: '0 0 0.5rem'}}>
            <span style={{color: 'var(--accent-green)'}}>{cliente.empleados_activos}</span> activos / {cliente.total_empleados} totales
          </p>
          <Link to={`/admin/empleados?cliente_id=${id}`} className="btn btn-outline" style={{textDecoration: 'none', fontSize: '0.85rem', padding: '0.3rem 0.6rem'}}>Ver todos →</Link>
        </div>
      </div>

      {/* ═══ MODALS ═══ */}

      {/* Employee creation modal */}
      {isEmpModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '480px'}}>
            <h3 style={{marginTop: 0}}>Agregar Empleado a {cliente.razon_social}</h3>
            {empError && <div style={{padding: '0.75rem', marginBottom: '1rem', background: '#ffe0e0', color: '#c00', borderRadius: '4px'}}>{empError}</div>}
            <form onSubmit={handleCreateEmpleado}>
              <label>Nombre Completo</label>
              <input type="text" required value={empForm.nombre_completo} onChange={e => setEmpForm({...empForm, nombre_completo: e.target.value})} placeholder="Nombre y apellido" />
              <label>DNI</label>
              <input type="text" value={empForm.dni} onChange={e => setEmpForm({...empForm, dni: e.target.value})} placeholder="12345678" />
              <label>Email</label>
              <input type="email" value={empForm.email} onChange={e => setEmpForm({...empForm, email: e.target.value})} placeholder="empleado@empresa.com" />
              <div style={{display: 'flex', gap: '1rem', marginTop: '1rem'}}>
                <button type="button" className="btn" onClick={() => setIsEmpModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-success">Guardar Empleado</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Client Edit Modal */}
      {isClientEditModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '500px'}}>
            <h2>Editar Cliente</h2>
            <form onSubmit={handleClientUpdate}>
              <label>Razón Social</label>
              <input type="text" value={clientEditForm.razon_social} onChange={e => setClientEditForm({...clientEditForm, razon_social: e.target.value})} required style={{width: '100%', marginBottom: '1rem', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '4px'}} />
              <label>CUIT</label>
              <input type="text" value={clientEditForm.cuit} onChange={e => setClientEditForm({...clientEditForm, cuit: e.target.value})} required style={{width: '100%', marginBottom: '1rem', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '4px'}} />
              <label>Rubro Principal</label>
              <select value={clientEditForm.rubro_id || ""} onChange={e => setClientEditForm({...clientEditForm, rubro_id: e.target.value})} style={{width: '100%', marginBottom: '1rem', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '4px'}}>
                <option value="">-- Sin Rubro --</option>
                {rubros.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
              </select>
              <label>Áreas Asociadas</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', padding: '0.75rem', border: '1px solid var(--border-color)', borderRadius: '8px', marginBottom: '1rem', minHeight: '48px', background: '#fafbfc' }}>
                {areasList.length === 0 && <span style={{color: 'var(--text-light)', fontSize: '0.85rem'}}>No hay áreas disponibles</span>}
                {areasList.map(a => {
                  const isSelected = clientEditForm.area_ids.includes(a.id);
                  return (
                    <button key={a.id} type="button"
                      onClick={() => {
                        const newIds = isSelected ? clientEditForm.area_ids.filter(aid => aid !== a.id) : [...clientEditForm.area_ids, a.id];
                        setClientEditForm({...clientEditForm, area_ids: newIds});
                      }}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.75rem', borderRadius: '20px',
                        border: isSelected ? '2px solid var(--primary-color)' : '1px solid #d1d5db',
                        background: isSelected ? 'var(--primary-color)' : '#fff',
                        color: isSelected ? '#fff' : 'var(--text-main)',
                        fontWeight: isSelected ? 600 : 400, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.15s ease'
                      }}>
                      <span style={{fontSize: '0.75rem'}}>{isSelected ? '✓' : '+'}</span>{a.nombre}
                    </button>
                  );
                })}
              </div>
              {clientEditForm.area_ids.length > 0 && (
                <div style={{fontSize: '0.8rem', color: 'var(--text-light)', marginBottom: '0.75rem', marginTop: '-0.5rem'}}>
                  {clientEditForm.area_ids.length} área{clientEditForm.area_ids.length !== 1 ? 's' : ''} seleccionada{clientEditForm.area_ids.length !== 1 ? 's' : ''}
                </div>
              )}
              <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', cursor: 'pointer'}}>
                <input type="checkbox" checked={clientEditForm.activo} onChange={e => setClientEditForm({...clientEditForm, activo: e.target.checked})} />
                Cliente Activo
              </label>
              <div style={{display: 'flex', gap: '1rem', justifyContent: 'flex-end'}}>
                <button type="button" className="btn btn-outline" onClick={() => setIsClientEditModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete/Archive Confirmation Modal */}
      {deleteModal.show && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '450px'}}>
            <h3 style={{marginTop: 0, color: deleteModal.mode === 'delete' ? '#dc2626' : '#d97706'}}>
              {deleteModal.mode === 'delete' ? 'Eliminar Cliente' : 'Archivar Cliente'}
            </h3>
            <p>
              {deleteModal.mode === 'delete' 
                ? `¿Estás seguro de que deseas eliminar permanentemente a "${cliente.razon_social}"? Esta acción no se puede deshacer, ya que el cliente no posee registros de ejecución.`
                : `"${cliente.razon_social}" posee historial de ejecución. No puede ser eliminado permanentemente para preservar la integridad de los datos. En su lugar, será desactivado (archivado).`}
            </p>
            <div style={{display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '1.5rem'}}>
              <button className="btn btn-outline" onClick={() => setDeleteModal({ show: false, mode: 'none' })} disabled={isDeleting}>Cancelar</button>
              <button 
                className="btn" 
                style={{background: deleteModal.mode === 'delete' ? '#dc2626' : '#d97706', color: 'white'}}
                onClick={handleDestructiveAction} 
                disabled={isDeleting}
              >
                {isDeleting ? 'Procesando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
