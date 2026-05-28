import React, { useEffect, useState } from 'react';
import { authFetch } from '../utils/apiClient';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import ImportEmpleadosModal from '../components/ImportEmpleadosModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export default function Empleados() {
  const [empleados, setEmpleados] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [areas, setAreas] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState({ nombre_completo: '', email: '', cliente_id: '', dni: '', activo: true, area_id: '' });
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterClienteId = searchParams.get('cliente_id');

  const fetchData = async () => {
    try {
      const empUrl = filterClienteId
        ? `${API_URL}/empleados/?cliente_id=${filterClienteId}`
        : `${API_URL}/empleados/`;
      const resEmp = await authFetch(empUrl);
      if (resEmp.ok) setEmpleados(await resEmp.json());
      const resCli = await authFetch(`${API_URL}/clientes/`);
      if (resCli.ok) setClientes(await resCli.json());
    } catch (err) { console.error(err); }
  };

  const openCreateModal = () => {
    setFormData({ nombre_completo: '', email: '', cliente_id: '', dni: '', activo: true, area_id: '' });
    setIsEditMode(false);
    setEditId(null);
    setIsModalOpen(true);
  };

  const openEditModal = (empleado) => {
    setFormData({
      nombre_completo: empleado.nombre_completo,
      email: empleado.email || '',
      cliente_id: empleado.cliente_id || '',
      dni: empleado.dni || '',
      activo: empleado.activo,
      area_id: empleado.area_id || ''
    });
    setIsEditMode(true);
    setEditId(empleado.id);
    setIsModalOpen(true);
  };

  useEffect(() => {
    fetchData();
  }, [filterClienteId]);

  useEffect(() => {
    const fetchAreas = async () => {
      if (formData.cliente_id) {
        try {
          const res = await authFetch(`${API_URL}/clientes/${formData.cliente_id}/areas`);
          if (res.ok) setAreas(await res.json());
          else setAreas([]);
        } catch (e) {
          setAreas([]);
        }
      } else {
        setAreas([]);
      }
    };
    fetchAreas();
  }, [formData.cliente_id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      nombre_completo: formData.nombre_completo,
      email: formData.email,
      cliente_id: parseInt(formData.cliente_id),
      dni: formData.dni,
      activo: String(formData.activo) === 'true',
      area_id: formData.area_id ? parseInt(formData.area_id) : null
    };

    const method = isEditMode ? 'PUT' : 'POST';
    const endpoint = isEditMode ? `${API_URL}/empleados/${editId}` : `${API_URL}/empleados/`;

    try {
      const res = await authFetch(endpoint, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) { 
        const text = await res.text(); 
        throw new Error(`HTTP ${res.status}: ${text}`); 
      }
      await res.json();
      setIsModalOpen(false);
      setFormData({ nombre_completo: '', email: '', cliente_id: '', dni: '', activo: true });
      await fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleBaja = async (empleadoId, nombre) => {
    if (!window.confirm(`¿Estás seguro de dar de baja a ${nombre}? El empleado quedará inactivo y no podrá acceder al portal.`)) return;
    try {
      const res = await authFetch(`${API_URL}/empleados/${empleadoId}/baja`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Error al dar de baja');
      await fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleReactivar = async (empleadoId, nombre) => {
    if (!window.confirm(`¿Reactivar a ${nombre}?`)) return;
    try {
      const res = await authFetch(`${API_URL}/empleados/${empleadoId}/reactivar`, {
        method: 'PATCH',
      });
      if (!res.ok) throw new Error('Error al reactivar');
      await fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const filteredEmpleados = empleados.filter(emp => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (emp.nombre_completo || '').toLowerCase().includes(term) ||
      (emp.dni || '').toLowerCase().includes(term) ||
      (emp.email || '').toLowerCase().includes(term)
    );
  });

  const filterClienteName = filterClienteId ? clientes.find(c => c.id === parseInt(filterClienteId))?.razon_social : null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          {filterClienteId && (
            <Link to={`/admin/clientes/${filterClienteId}`} style={{color: 'var(--text-light)', textDecoration: 'none', marginBottom: '0.5rem', display: 'inline-block'}}>â† Volver a {filterClienteName || 'Cliente'}</Link>
          )}
          <h2 style={{ margin: 0 }}>
            {filterClienteName ? `Empleados de ${filterClienteName}` : 'GestiÃ³n de Empleados'}
          </h2>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn btn-outline" onClick={() => setIsImportOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            ðŸ“¥ Importar Excel
          </button>
          <button className="btn btn-primary" onClick={openCreateModal}>+ Ingresar Empleado</button>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{ marginTop: 0 }}>{isEditMode ? 'Editar Empleado' : 'Registrar Empleado a Capacitar'}</h3>
            <form onSubmit={handleSubmit}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Nombre Completo</label>
              <input type="text" required value={formData.nombre_completo} onChange={e => setFormData({ ...formData, nombre_completo: e.target.value })} placeholder="Ej: MarÃ­a RodrÃ­guez" />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Documento (DNI)</label>
                  <input type="text" required value={formData.dni} onChange={e => setFormData({ ...formData, dni: e.target.value })} placeholder="Ej: 12345678" />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Estado Operativo</label>
                  <select required value={formData.activo} onChange={e => setFormData({ ...formData, activo: e.target.value === 'true' })}>
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
              </div>

              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Correo de Contacto (opcional)</label>
              <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="maria@empresa.com" />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Cliente o Empresa</label>
                  <select required value={formData.cliente_id} onChange={e => setFormData({ ...formData, cliente_id: e.target.value })}>
                    <option value="">-- Selecciona --</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Ãrea</label>
                  <select value={formData.area_id} onChange={e => setFormData({ ...formData, area_id: e.target.value })}>
                    <option value="">-- No registrada --</option>
                    {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="button" className="btn" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-success">{isEditMode ? 'Guardar Cambios' : 'Guardar Registro'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

            <div style={{ marginBottom: '1.5rem', position: 'relative' }}>
        <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)' }}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
        <input
          type="text"
          placeholder="Buscar por nombre, DNI o email..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{
            width: '100%',
            padding: '0.75rem 1rem 0.75rem 2.75rem',
            border: '1px solid var(--border-color)',
            borderRadius: '10px',
            fontSize: '0.95rem',
            background: 'white',
            outline: 'none',
            boxSizing: 'border-box'
          }}
        />
        {searchTerm && (
          <span style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem', color: 'var(--text-light)' }}>
            {filteredEmpleados.length} resultado{filteredEmpleados.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
            <tr>
              <th style={{ padding: '1rem' }}>Nombre Completo</th>
              <th style={{ padding: '1rem' }}>DNI</th>
              <th style={{ padding: '1rem' }}>Empresa</th>
              <th style={{ padding: '1rem' }}>Email</th>
              <th style={{ padding: '1rem' }}>Ãrea</th>
              <th style={{ padding: '1rem' }}>Estado MÃ³dulo</th>
              <th style={{ padding: '1rem' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmpleados.length > 0 ? filteredEmpleados.map(c => (
              <tr
                key={c.id}
                className="clickable-row"
                onClick={() => navigate(`/admin/empleados/${c.id}`)}
                style={{ borderBottom: '1px solid var(--border-color)' }}
              >
                <td style={{ padding: '1rem', fontWeight: 500 }}>{c.nombre_completo}</td>
                <td style={{ padding: '1rem', color: 'var(--text-light)' }}>{c.dni || 'No registrado'}</td>
                <td style={{ padding: '1rem' }}>{clientes.find(cl => cl.id === c.cliente_id)?.razon_social || 'No registrado'}</td>
                <td style={{ padding: '1rem' }}>{c.email || 'No registrado'}</td>
                <td style={{ padding: '1rem', color: 'var(--text-light)' }}>{c.area_nombre || 'No asignada'}</td>
                <td style={{ padding: '1rem' }}>
                  <span className={`badge ${c.activo ? 'badge-success' : 'badge-danger'}`}>
                    {c.activo ? 'Vigente' : 'Inactivo'}
                  </span>
                </td>
                <td style={{ padding: '1rem' }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Link to={`/admin/empleados/${c.id}`} className="btn" style={{ background: '#eee', textDecoration: 'none' }}>Ver Ficha</Link>
                    <button onClick={(e) => { e.stopPropagation(); openEditModal(c); }} className="btn btn-outline" style={{ padding: '0.5rem 1rem' }}>Editar</button>
                    {c.activo ? (
                      <button onClick={(e) => { e.stopPropagation(); handleBaja(c.id, c.nombre_completo); }} className="btn" style={{ padding: '0.5rem 1rem', background: '#FEE2E2', color: '#991B1B', border: 'none', fontSize: '0.85rem' }}>Dar de Baja</button>
                    ) : (
                      <button onClick={(e) => { e.stopPropagation(); handleReactivar(c.id, c.nombre_completo); }} className="btn" style={{ padding: '0.5rem 1rem', background: '#D1FAE5', color: '#065F46', border: 'none', fontSize: '0.85rem' }}>Reactivar</button>
                    )}
                  </div>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan="4" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-light)' }}>
                  No hay empleados registrados en sus clientes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Import Modal */}
      <ImportEmpleadosModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onSuccess={fetchData}
        clientes={clientes}
      />
    </div>
  );
}
