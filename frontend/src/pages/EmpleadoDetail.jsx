import React, { useState, useEffect } from 'react';
import { authFetch } from '../utils/apiClient';
import { useParams, Link, useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export default function EmpleadoDetail() {
  const { id } = useParams();
  const [empleado, setEmpleado] = useState(null);
  const [error, setError] = useState(null);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [areas, setAreas] = useState([]);
  const [formData, setFormData] = useState({ nombre_completo: '', email: '', cliente_id: '', dni: '', activo: true, area_id: '' });

  // Delete/Baja modal
  const [deleteModal, setDeleteModal] = useState({ show: false, mode: 'none' }); // 'delete' or 'archive'
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();

  const loadData = async () => {
    try {
      const res1 = await authFetch(`${API_URL}/empleados/${id}`);
      if (!res1.ok) { 
        const text = await res1.text(); 
        throw new Error(`HTTP ${res1.status}: ${text}`); 
      }
      setEmpleado(await res1.json());
    } catch (err) {
      setError(err.message);
    }

    try {
      const res2 = await authFetch(`${API_URL}/clientes/`);
      if (res2.ok) setClientes(await res2.json());
    } catch (e) {}
  };

  useEffect(() => {
    loadData();
  }, [id]);

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

  const openEditModal = () => {
    setFormData({ 
      nombre_completo: empleado.nombre_completo, 
      email: empleado.email || '', 
      cliente_id: empleado.cliente_id || '', 
      dni: empleado.dni || '', 
      activo: empleado.activo,
      area_id: empleado.area_id || ''
    });
    setIsModalOpen(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await authFetch(`${API_URL}/empleados/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre_completo: formData.nombre_completo,
          email: formData.email,
          cliente_id: parseInt(formData.cliente_id),
          dni: formData.dni,
          activo: String(formData.activo) === 'true',
          area_id: formData.area_id ? parseInt(formData.area_id) : null
        })
      });
      if (!res.ok) { 
        const text = await res.text(); 
        throw new Error(`HTTP ${res.status}: ${text}`); 
      }
      await res.json();
      setIsModalOpen(false);
      await loadData(); 
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDestructiveAction = async () => {
    setIsDeleting(true);
    try {
      if (deleteModal.mode === 'delete') {
        const res = await authFetch(`${API_URL}/empleados/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(await res.text());
        navigate('/admin/empleados');
      } else if (deleteModal.mode === 'archive') {
        const res = await authFetch(`${API_URL}/empleados/${id}/baja`, { method: 'PATCH' });
        if (!res.ok) throw new Error(await res.text());
        setDeleteModal({ show: false, mode: 'none' });
        await loadData(); // Reload to reflect changes
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
      setDeleteModal({ show: false, mode: 'none' });
    } finally {
      setIsDeleting(false);
    }
  };

  if (error) return <div style={{color: 'var(--accent-red)', padding: '2rem'}}>{error}</div>;
  if (!empleado) return <div style={{padding: '2rem'}}>Cargando ficha de empleado real...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', alignItems: 'center' }}>
        <div>
          <Link to="/admin/empleados" style={{color: 'var(--text-light)', textDecoration: 'none', marginBottom: '0.5rem', display: 'inline-block'}}>← Directorio de Empleados</Link>
          <h2 style={{margin: 0}}>{empleado?.nombre_completo || 'Cargando...'}</h2>
          <p style={{color: 'var(--text-light)', margin: '0.5rem 0 0 0'}}>Compañía: <strong>{empleado?.cliente?.razon_social || 'Sin empresa'}</strong></p>
        </div>
        <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
          <button onClick={openEditModal} className="btn btn-outline" style={{padding: '0.35rem 0.75rem', fontSize: '0.85rem'}}>⚙️ Editar empleado</button>
          {empleado.can_delete && (
            <button 
              className="btn" 
              style={{padding: '0.35rem 0.75rem', fontSize: '0.85rem', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5'}}
              onClick={() => setDeleteModal({ show: true, mode: 'delete' })}
            >
              🗑️ Eliminar
            </button>
          )}
          {!empleado.can_delete && empleado.can_archive && empleado.activo && (
            <button 
              className="btn" 
              style={{padding: '0.35rem 0.75rem', fontSize: '0.85rem', background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d'}}
              onClick={() => setDeleteModal({ show: true, mode: 'archive' })}
            >
              📦 Dar de Baja
            </button>
          )}
          <span className={`badge ${empleado.activo ? 'badge-success' : 'badge-danger'}`} style={{fontSize: '0.95rem'}}>
            {empleado.activo ? 'Colaborador Vigente' : 'Inactivo'}
          </span>
        </div>
      </div>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3 style={{marginTop: 0}}>Editar Empleado</h3>
            <form onSubmit={handleEditSubmit}>
              <label style={{display: 'block', marginBottom: '0.5rem', fontWeight: 500}}>Nombre Completo</label>
              <input type="text" required value={formData.nombre_completo} onChange={e => setFormData({...formData, nombre_completo: e.target.value})} placeholder="Ej: María Rodríguez" />
              
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                <div>
                  <label style={{display: 'block', marginBottom: '0.5rem', fontWeight: 500}}>Documento (DNI)</label>
                  <input type="text" required value={formData.dni} onChange={e => setFormData({...formData, dni: e.target.value})} placeholder="Ej: 12345678" />
                </div>
                <div>
                  <label style={{display: 'block', marginBottom: '0.5rem', fontWeight: 500}}>Estado Operativo</label>
                  <select required value={formData.activo} onChange={e => setFormData({...formData, activo: e.target.value === 'true'})}>
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
              </div>

              <label style={{display: 'block', marginBottom: '0.5rem', fontWeight: 500}}>Correo de Contacto</label>
              <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="maria@empresa.com" />
              
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                <div>
                  <label style={{display: 'block', marginBottom: '0.5rem', fontWeight: 500}}>Cliente o Empresa</label>
                  <select required value={formData.cliente_id} onChange={e => setFormData({...formData, cliente_id: e.target.value})}>
                    <option value="">-- Selecciona --</option>
                    {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{display: 'block', marginBottom: '0.5rem', fontWeight: 500}}>Área</label>
                  <select value={formData.area_id} onChange={e => setFormData({...formData, area_id: e.target.value})}>
                    <option value="">-- No registrada --</option>
                    {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                  </select>
                </div>
              </div>

              <div style={{display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'flex-end'}}>
                <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>Cancelar</button>
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
              {deleteModal.mode === 'delete' ? 'Eliminar Empleado' : 'Dar de Baja'}
            </h3>
            <p>
              {deleteModal.mode === 'delete' 
                ? `¿Estás seguro de que deseas eliminar permanentemente a "${empleado.nombre_completo}"? Esta acción no se puede deshacer, ya que el empleado no posee registros de ejecución o certificados.`
                : `"${empleado.nombre_completo}" posee historial de ejecución (evaluaciones/certificados). No puede ser eliminado permanentemente para preservar la integridad de los datos. En su lugar, será dado de baja (desactivado).`}
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

      <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '2rem'}}>
        <div className="card">
          <h3 style={{marginTop: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem'}}>Información de Contacto</h3>
          <p><strong>Documento de Identidad (DNI):</strong> {empleado?.dni || 'No registrado'}</p>
          <p><strong>Email Operativo:</strong> {empleado?.email || 'No registrado'}</p>
          <p><strong>Empresa / Cliente:</strong> {empleado?.cliente?.razon_social ? `${empleado.cliente.razon_social} (ID: ${empleado.cliente_id})` : 'No registrado'}</p>
          <p><strong>Área asignada:</strong> {empleado?.area_nombre || 'No registrada'}</p>
          <p><strong>ID Interno (Sistema):</strong> EMP-{empleado?.id}</p>
        </div>

        <div className="card">
          <h3 style={{marginTop: 0, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem'}}>Resumen Compliance</h3>
          <p><strong>Certificados Vigentes:</strong> <span style={{color: 'var(--accent-green)', fontWeight: 'bold'}}>{empleado?.certificados?.length || 0}</span></p>
          <p><strong>Clases Asignadas Históricas:</strong> {empleado?.capacitaciones_asignadas?.length || 0}</p>
        </div>
      </div>

      <div className="card" style={{padding: 0, overflow: 'hidden', marginBottom: '2rem'}}>
        <h3 style={{padding: '1rem', margin: 0, background: '#f8fafc', borderBottom: '1px solid var(--border-color)'}}>Historial de Capacitaciones</h3>
        <table style={{width: '100%', borderCollapse: 'collapse', textAlign: 'left'}}>
          <thead style={{background: '#fcfcfc', borderBottom: '1px solid var(--border-color)'}}>
            <tr>
              <th style={{padding: '1rem'}}>Capacitación</th>
              <th style={{padding: '1rem'}}>Fecha de asignación</th>
              <th style={{padding: '1rem'}}>Estado</th>
              <th style={{padding: '1rem'}}>Nota</th>
              <th style={{padding: '1rem'}}>Certificado</th>
            </tr>
          </thead>
          <tbody>
            {empleado?.capacitaciones_asignadas && empleado.capacitaciones_asignadas.length > 0 ? empleado.capacitaciones_asignadas.map(c => {
              const cert = empleado?.certificados ? empleado.certificados.find(ce => ce.capacitacion === c.capacitacion) : null;
              return (
                <tr key={c.id} style={{borderBottom: '1px solid var(--border-color)'}}>
                  <td style={{padding: '1rem', fontWeight: 500}}>{c.capacitacion}</td>
                  <td style={{padding: '1rem'}}>{c.fecha}</td>
                  <td style={{padding: '1rem'}}>
                    <span className={`badge ${c.estado === 'Aprobado' ? 'badge-success' : 'badge-outline'}`} style={{fontSize: '0.8rem'}}>
                      {c.estado}
                    </span>
                  </td>
                  <td style={{padding: '1rem', fontWeight: 600, color: c.estado === 'Aprobado' ? 'var(--accent-green)' : 'inherit'}}>
                    {c.nota}
                  </td>
                  <td style={{padding: '1rem', fontSize: '0.85rem', color: 'var(--text-light)'}}>
                    {cert ? (
                      <span title={`Hash: ${cert.hash}`} style={{color: 'var(--accent-green)'}}>
                        Vigente (Vence: {cert.vencimiento})
                      </span>
                    ) : (
                      'No disponible'
                    )}
                  </td>
                </tr>
              );
            }) : (
              <tr>
                <td colSpan="5" style={{padding: '2rem', textAlign: 'center', color: 'var(--text-light)'}}>
                  Este empleado todavía no tiene capacitaciones asignadas
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
