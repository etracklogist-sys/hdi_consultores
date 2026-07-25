import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { authFetch } from '../utils/apiClient';
import { useParams, Link, useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export default function ClienteProgramadaDetail() {
  const { id, programadaId } = useParams(); // id = clienteId
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [employees, setEmployees] = useState(null); // {asignados, elegibles_no_asignados}
  const [attendance, setAttendance] = useState([]); // Attendance records
  const [error, setError] = useState(null);
  const [notification, setNotification] = useState(null);
  const [actionLoading, setActionLoading] = useState(null); // Track which employee_id is being acted on
  const [showElegibles, setShowElegibles] = useState(false);
  const [attendanceSaving, setAttendanceSaving] = useState(false);
  const [showAttendance, setShowAttendance] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [reviews, setReviews] = useState(null);

  const loadAll = useCallback(async () => {
    try {
      const resCliente = await authFetch(`${API_URL}/clientes/${id}`);
      if (resCliente.ok) setCliente(await resCliente.json());
    } catch (e) { console.error(e); }

    try {
      const resAsig = await authFetch(`${API_URL}/clientes/${id}/programadas/${programadaId}/asignaciones`);
      if (!resAsig.ok) {
        const text = await resAsig.text();
        throw new Error(`HTTP ${resAsig.status}: ${text}`);
      }
      setData(await resAsig.json());
    } catch (err) {
      setError(err.message);
    }

    // Load employee management data
    try {
      const resEmp = await authFetch(`${API_URL}/plan-anual/programadas/${programadaId}/empleados`);
      if (resEmp.ok) {
        setEmployees(await resEmp.json());
      }
    } catch (e) { console.error('Error loading employee management data:', e); }

    // Load attendance data
    try {
      const resAtt = await authFetch(`${API_URL}/asignaciones/programada/${programadaId}/attendance`);
      if (resAtt.ok) {
        setAttendance(await resAtt.json());
      }
    } catch (e) { console.error('Error loading attendance:', e); }
  }, [id, programadaId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // —— Add Employee ——
  const handleAddEmployee = async (empleadoId) => {
    setActionLoading(empleadoId);
    setNotification(null);
    try {
      const res = await authFetch(`${API_URL}/plan-anual/programadas/${programadaId}/asignar`, {
        method: 'POST',
        body: JSON.stringify({ empleado_id: empleadoId })
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }
      const result = await res.json();
      setNotification({ type: 'success', text: result.mensaje || 'Empleado asignado.' });
      await loadAll();
    } catch (err) {
      setNotification({ type: 'error', text: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  // —— Remove Employee ——
  const handleRemoveEmployee = async (asignacionId, nombreEmpleado) => {
    if (!confirm(`¿Quitar a ${nombreEmpleado} de esta capacitación?`)) return;
    setActionLoading(asignacionId);
    setNotification(null);
    try {
      const res = await authFetch(`${API_URL}/plan-anual/programadas/${programadaId}/asignaciones/${asignacionId}`, {
        method: 'DELETE'
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }
      setNotification({ type: 'success', text: `${nombreEmpleado} fue quitado de esta capacitación.` });
      await loadAll();
    } catch (err) {
      setNotification({ type: 'error', text: err.message });
    } finally {
      setActionLoading(null);
    }
  };

  // —— Attendance ——
  const handleAttendanceToggle = (asignacionId, value) => {
    setAttendance(prev => prev.map(a => 
      a.asignacion_id === asignacionId ? { ...a, asistio: value } : a
    ));
  };

  const handleSaveAttendance = async () => {
    setAttendanceSaving(true);
    setNotification(null);
    try {
      const payload = {
        programada_id: parseInt(programadaId),
        attendance: attendance.map(a => ({
          asignacion_id: a.asignacion_id,
          asistio: a.asistio || false
        }))
      };
      const res = await authFetch(`${API_URL}/asignaciones/attendance`, {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }
      const result = await res.json();
      setNotification({ type: 'success', text: result.message || 'Asistencia guardada.' });
      await loadAll();
    } catch (err) {
      setNotification({ type: 'error', text: err.message });
    } finally {
      setAttendanceSaving(false);
    }
  };

  // —— Export Participants ——
  const handleExportParticipants = async () => {
    setExporting(true);
    setNotification(null);
    try {
      const res = await authFetch(`${API_URL}/plan-anual/programadas/${programadaId}/export-participantes`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `participantes_programada_${programadaId}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setNotification({ type: 'success', text: 'Archivo exportado correctamente.' });
    } catch (err) {
      setNotification({ type: 'error', text: `Error al exportar: ${err.message}` });
    } finally {
      setExporting(false);
    }
  };

  // —— Export Acta PDF ——
  const handleExportPdf = async () => {
    setExportingPdf(true);
    setNotification(null);
    try {
      const res = await authFetch(`${API_URL}/plan-anual/programadas/${programadaId}/acta-pdf`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ActaCapacitacion_${programadaId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setNotification({ type: 'success', text: 'Acta PDF generada correctamente.' });
    } catch (err) {
      setNotification({ type: 'error', text: `Error al generar PDF: ${err.message}` });
    } finally {
      setExportingPdf(false);
    }
  };

  const sortedEmpleados = useMemo(() => {
    if (!data || !data.empleados) return [];
    const statusWeight = { "pendiente": 1, "en_curso": 2, "aprobado": 3 };
    return [...data.empleados].sort((a, b) => {
      const wa = statusWeight[a.estado] || 99;
      const wb = statusWeight[b.estado] || 99;
      return wa - wb;
    });
  }, [data]);

  // Merge the employees data — use the employees endpoint for assigned status
  const asignados = employees?.asignados || [];
  const elegibles = employees?.elegibles_no_asignados || [];
  const canManage = employees?.estado && ['ACTIVA', 'PROGRAMADA'].includes(employees.estado);

  // Determine if this is a presential training (for attendance section)
  const isPresencial = data?.programada?.modalidad_final === 'presencial' || 
                       data?.programada?.modalidad_final?.toLowerCase().includes('presencial');

  if (error) return <div style={{padding: '2rem', color: 'var(--accent-red)'}}>{error}</div>;
  if (!data || !cliente) return <div style={{padding: '2rem'}}>Cargando...</div>;

  const { programada, resumen } = data;
  const porcentaje = resumen.total > 0 ? Math.round((resumen.aprobados / resumen.total) * 100) : 0;
  const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const mesNombre = meses[programada.mes - 1] || programada.mes;

  let statusBadgeClass = "badge-warning";
  let statusText = "Cumplimiento Parcial";
  if (resumen.total > 0 && resumen.aprobados === resumen.total) {
    statusBadgeClass = "badge-success";
    statusText = "Completado 100%";
  } else if (resumen.total > 0 && resumen.pendientes === resumen.total) {
    statusBadgeClass = "badge-danger";
    statusText = "Pendiente 100%";
  } else if (resumen.total === 0) {
    statusBadgeClass = "badge-danger";
    statusText = "Sin asignaciones";
  }

  const getStatusBadge = (estado) => {
    if (estado === 'aprobado') return 'badge-success';
    if (estado === 'en_curso') return 'badge-warning';
    return 'badge-danger';
  };

  const estadoBadge = (estado) => {
    const styles = {
      ACTIVA: { bg: '#ECFDF5', color: '#059669', label: 'ACTIVA' },
      PROGRAMADA: { bg: '#FFFBEB', color: '#D97706', label: 'LISTA PARA ACTIVAR' },
      FINALIZADA: { bg: '#F1F5F9', color: '#64748B', label: 'FINALIZADA' },
      CANCELADA: { bg: '#FEF2F2', color: '#DC2626', label: 'CANCELADA' }
    };
    const s = styles[estado] || { bg: '#F1F5F9', color: '#64748B', label: estado };
    return (
      <span style={{
        padding: '0.3rem 0.75rem', borderRadius: '8px', fontSize: '0.78rem', fontWeight: 700,
        background: s.bg, color: s.color
      }}>{s.label}</span>
    );
  };

  const attendedCount = attendance.filter(a => a.asistio).length;

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
        <div>
          <Link to={`/admin/clientes/${id}`} style={{color: 'var(--text-light)', textDecoration: 'none', marginBottom: '0.5rem', display: 'inline-block'}}>← Volver a {cliente.razon_social}</Link>
          <h2 style={{margin: '0 0 0.25rem 0'}}>{programada.nombre}</h2>
          <div style={{display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.5rem'}}>
            <span style={{color: 'var(--text-light)', fontSize: '1rem', fontWeight: 500}}>
              {mesNombre} {programada.anio} · {programada.tipo}
            </span>
            {estadoBadge(programada.estado)}
          </div>
          <p style={{color: 'var(--text-light)', margin: 0}}>Centro de asignaciones — <strong>{cliente.razon_social}</strong></p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn"
            onClick={handleExportParticipants}
            disabled={exporting || asignados.length === 0}
            style={{
              background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE',
              fontSize: '0.82rem', padding: '0.5rem 1rem', borderRadius: '8px',
              cursor: asignados.length === 0 ? 'not-allowed' : 'pointer', fontWeight: 600,
              opacity: asignados.length === 0 ? 0.5 : 1
            }}
          >
            {exporting ? 'Exportando...' : '📥 Exportar CSV'}
          </button>
          
          <button
            className="btn"
            onClick={handleExportPdf}
            disabled={exportingPdf || asignados.length === 0}
            style={{
              background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA',
              fontSize: '0.82rem', padding: '0.5rem 1rem', borderRadius: '8px',
              cursor: asignados.length === 0 ? 'not-allowed' : 'pointer', fontWeight: 600,
              opacity: asignados.length === 0 ? 0.5 : 1
            }}
          >
            {exportingPdf ? 'Generando...' : '📄 Descargar Acta PDF'}
          </button>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div style={{
          padding: '0.75rem 1rem', marginBottom: '1.5rem', borderRadius: '8px',
          background: notification.type === 'error' ? '#FEF2F2' : '#ECFDF5',
          color: notification.type === 'error' ? '#DC2626' : '#059669',
          border: `1px solid ${notification.type === 'error' ? '#FECACA' : '#A7F3D0'}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem'
        }}>
          <span>{notification.text}</span>
          <button onClick={() => setNotification(null)} style={{background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'inherit'}}>×</button>
        </div>
      )}

      {/* Instance Details Card */}
      <div className="card" style={{ marginBottom: '2rem', borderLeft: '4px solid var(--primary-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: '0 0 0.5rem 0' }}>Detalles de la Instancia</h3>
            <p style={{ margin: 0, color: 'var(--text-light)' }}>
              <strong>Modalidad:</strong> {programada.tipo_modalidad || 'N/A'} &nbsp;|&nbsp;
              <strong>Área:</strong> {programada.area}
            </p>
          </div>
          <span className={`badge ${statusBadgeClass}`} style={{ fontSize: '1rem', padding: '0.5rem 1rem' }}>
            {statusText}
          </span>
        </div>
      </div>

      {/* Status Banner */}
      {resumen.total > 0 && (
        <div style={{ marginBottom: '2rem', padding: '1rem', borderRadius: '8px', background: resumen.pendientes > 0 ? '#fffbeb' : '#f0fdf4', border: `1px solid ${resumen.pendientes > 0 ? '#f59e0b' : '#22c55e'}`, color: resumen.pendientes > 0 ? '#b45309' : '#15803d', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {resumen.pendientes > 0 ? (
             <>⚠️ <strong>{resumen.pendientes}</strong> empleados pendientes de completar esta capacitación.</>
          ) : (
             <>✅ Todos los empleados han completado esta capacitación exitosamente.</>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="kpi-grid" style={{ marginBottom: '2rem' }}>
        <div className="card kpi-card" style={{borderTop: '4px solid var(--primary-color)'}}>
          <h4>Total Asignados</h4>
          <p className="kpi-value" style={{color: 'var(--primary-color)'}}>{resumen.total}</p>
        </div>
        <div className="card kpi-card" style={{borderTop: '4px solid var(--accent-green)'}}>
          <h4>Aprobados</h4>
          <p className="kpi-value" style={{color: 'var(--accent-green)'}}>{resumen.aprobados}</p>
        </div>
        <div className="card kpi-card" style={{borderTop: '4px solid var(--accent-red)'}}>
          <h4>Pendientes</h4>
          <p className="kpi-value" style={{color: 'var(--accent-red)'}}>{resumen.pendientes}</p>
        </div>
        <div className="card kpi-card" style={{borderTop: '4px solid var(--secondary-color)'}}>
          <h4>% Cumplimiento</h4>
          <p className="kpi-value" style={{color: 'var(--secondary-color)'}}>{porcentaje}%</p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
           SECTION: ASSIGNED EMPLOYEES
         ═══════════════════════════════════════════════════════════════ */}
      <div className="card" style={{padding: 0, overflow: 'hidden', marginBottom: '1.5rem'}}>
        <div style={{padding: '1rem 1.25rem', background: '#f8fafc', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <h3 style={{margin: 0}}>👥 Empleados Asignados <span style={{fontWeight: 400, fontSize: '0.85rem', color: 'var(--text-light)'}}>({asignados.length})</span></h3>
        </div>

        {asignados.length === 0 ? (
          <div style={{padding: '2rem', textAlign: 'center', color: 'var(--text-light)'}}>
            <div style={{fontSize: '1.5rem', marginBottom: '0.5rem'}}>📋</div>
            No hay empleados asignados aún.
            {canManage && elegibles.length > 0 && (
              <div style={{marginTop: '0.75rem'}}>
                <button className="btn btn-primary" onClick={() => setShowElegibles(true)} style={{fontSize: '0.85rem'}}>
                  + Agregar empleados
                </button>
              </div>
            )}
          </div>
        ) : (
          <table style={{width: '100%', borderCollapse: 'collapse', textAlign: 'left'}}>
            <thead style={{borderBottom: '1px solid var(--border-color)'}}>
              <tr>
                <th style={{padding: '0.85rem 1rem'}}>Empleado</th>
                <th style={{padding: '0.85rem 1rem'}}>DNI</th>
                <th style={{padding: '0.85rem 1rem'}}>Área</th>
                <th style={{padding: '0.85rem 1rem'}}>Estado</th>
                <th style={{padding: '0.85rem 1rem'}}>Origen</th>
                <th style={{padding: '0.85rem 1rem', textAlign: 'right'}}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {asignados.map(emp => (
                <tr
                  key={emp.asignacion_id || emp.empleado_id}
                  style={{borderBottom: '1px solid #f1f5f9', transition: 'background 0.1s'}}
                  onMouseEnter={e => e.currentTarget.style.background = '#fafbfc'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <td style={{padding: '0.85rem 1rem', fontWeight: 500}}>
                    <Link to={`/admin/empleados/${emp.empleado_id}`} style={{color: 'inherit', textDecoration: 'none'}}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--primary-color)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'inherit'}
                    >{emp.nombre}</Link>
                  </td>
                  <td style={{padding: '0.85rem 1rem', color: 'var(--text-light)'}}>{emp.dni || 'N/A'}</td>
                  <td style={{padding: '0.85rem 1rem', color: 'var(--text-light)'}}>{emp.area}</td>
                  <td style={{padding: '0.85rem 1rem'}}>
                    <span className={`badge ${getStatusBadge(emp.estado)}`}>
                      {emp.estado.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                  <td style={{padding: '0.85rem 1rem', color: 'var(--text-light)', textTransform: 'capitalize', fontSize: '0.82rem'}}>{(emp.origen || 'manual').replace('_', ' ')}</td>
                  <td style={{padding: '0.85rem 1rem', textAlign: 'right'}}>
                    {emp.puede_quitar && canManage ? (
                      <button
                        className="btn"
                        onClick={() => handleRemoveEmployee(emp.asignacion_id, emp.nombre)}
                        disabled={actionLoading === emp.asignacion_id}
                        style={{
                          background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA',
                          fontSize: '0.78rem', padding: '0.3rem 0.65rem', borderRadius: '6px', cursor: 'pointer'
                        }}
                      >
                        {actionLoading === emp.asignacion_id ? '...' : 'Quitar'}
                      </button>
                    ) : (
                      <Link to={`/admin/empleados/${emp.empleado_id}`} className="btn" style={{background: '#F1F5F9', textDecoration: 'none', fontSize: '0.78rem', padding: '0.3rem 0.65rem', borderRadius: '6px'}}>Ver ficha</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
           SECTION: ATTENDANCE CONTROL (Presential Trainings)
         ═══════════════════════════════════════════════════════════════ */}
      {attendance.length > 0 && isPresencial && (
        <div className="card" style={{padding: 0, overflow: 'hidden', marginBottom: '1.5rem'}}>
          <div
            style={{
              padding: '1rem 1.25rem', background: '#f0f9ff', borderBottom: showAttendance ? '1px solid var(--border-color)' : 'none',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'
            }}
            onClick={() => setShowAttendance(!showAttendance)}
          >
            <h3 style={{margin: 0}}>
              📋 Control de Asistencia
              <span style={{fontWeight: 400, fontSize: '0.85rem', color: 'var(--text-light)', marginLeft: '0.5rem'}}>
                ({attendedCount}/{attendance.length} asistieron)
              </span>
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {isPresencial && (
                <span style={{
                  fontSize: '0.7rem', fontWeight: 700,
                  padding: '0.15rem 0.5rem', borderRadius: '6px',
                  background: '#dbeafe', color: '#1d4ed8',
                }}>
                  🏢 PRESENCIAL
                </span>
              )}
              <span style={{fontSize: '1.2rem', color: 'var(--text-light)', transition: 'transform 0.2s', transform: showAttendance ? 'rotate(180deg)' : 'rotate(0)'}}>▼</span>
            </div>
          </div>

          {showAttendance && (
            <>
              <div style={{ padding: '0.75rem 1.25rem', background: '#fffbeb', borderBottom: '1px solid #fde68a', fontSize: '0.82rem', color: '#92400e' }}>
                💡 En presenciales sin evaluación, marcar asistencia completa automáticamente la capacitación.
              </div>
              <table style={{width: '100%', borderCollapse: 'collapse', textAlign: 'left'}}>
                <thead style={{borderBottom: '1px solid var(--border-color)'}}>
                  <tr>
                    <th style={{padding: '0.85rem 1rem'}}>Empleado</th>
                    <th style={{padding: '0.85rem 1rem', textAlign: 'center'}}>¿Asistió?</th>
                    <th style={{padding: '0.85rem 1rem'}}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map(a => (
                    <tr key={a.asignacion_id} style={{borderBottom: '1px solid #f1f5f9'}}>
                      <td style={{padding: '0.85rem 1rem', fontWeight: 500}}>{a.empleado_nombre}</td>
                      <td style={{padding: '0.85rem 1rem', textAlign: 'center'}}>
                        <label style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer',
                          padding: '0.3rem 0.75rem', borderRadius: '8px',
                          background: a.asistio ? '#d1fae5' : '#f1f5f9',
                          border: `1px solid ${a.asistio ? '#6ee7b7' : '#e2e8f0'}`,
                          transition: 'all 0.2s',
                        }}>
                          <input
                            type="checkbox"
                            checked={a.asistio || false}
                            onChange={(e) => handleAttendanceToggle(a.asignacion_id, e.target.checked)}
                            style={{ width: '1rem', height: '1rem', cursor: 'pointer' }}
                          />
                          <span style={{ fontSize: '0.82rem', fontWeight: 600, color: a.asistio ? '#059669' : '#94a3b8' }}>
                            {a.asistio ? 'Asistió' : 'No asistió'}
                          </span>
                        </label>
                      </td>
                      <td style={{padding: '0.85rem 1rem', fontSize: '0.82rem', color: 'var(--text-light)'}}>
                        {a.completion_method === 'ATTENDANCE' ? (
                          <span style={{ color: '#059669', fontWeight: 600 }}>✅ Completado por asistencia</span>
                        ) : a.completed_at ? (
                          <span style={{ color: '#3b82f6', fontWeight: 600 }}>✅ Completado</span>
                        ) : (
                          <span>Pendiente</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleSaveAttendance}
                  disabled={attendanceSaving}
                  style={{ fontSize: '0.85rem', padding: '0.5rem 1.5rem' }}
                >
                  {attendanceSaving ? 'Guardando...' : '💾 Guardar Asistencia'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
           SECTION: ELIGIBLE EMPLOYEES (not yet assigned)
         ═══════════════════════════════════════════════════════════════ */}
      {canManage && (
        <div className="card" style={{padding: 0, overflow: 'hidden'}}>
          <div
            style={{
              padding: '1rem 1.25rem', background: '#f8fafc', borderBottom: showElegibles ? '1px solid var(--border-color)' : 'none',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer'
            }}
            onClick={() => setShowElegibles(!showElegibles)}
          >
            <h3 style={{margin: 0}}>
              ➕ Empleados Elegibles No Asignados
              <span style={{fontWeight: 400, fontSize: '0.85rem', color: 'var(--text-light)', marginLeft: '0.5rem'}}>
                ({elegibles.length})
              </span>
            </h3>
            <span style={{fontSize: '1.2rem', color: 'var(--text-light)', transition: 'transform 0.2s', transform: showElegibles ? 'rotate(180deg)' : 'rotate(0)'}}>▼</span>
          </div>

          {showElegibles && (
            <>
              {elegibles.length === 0 ? (
                <div style={{padding: '1.5rem', textAlign: 'center', color: 'var(--text-light)', fontSize: '0.85rem'}}>
                  <div style={{fontSize: '1.3rem', marginBottom: '0.5rem'}}>✅</div>
                  Todos los empleados elegibles ya están asignados.
                </div>
              ) : (
                <table style={{width: '100%', borderCollapse: 'collapse', textAlign: 'left'}}>
                  <thead style={{borderBottom: '1px solid var(--border-color)'}}>
                    <tr>
                      <th style={{padding: '0.85rem 1rem'}}>Empleado</th>
                      <th style={{padding: '0.85rem 1rem'}}>DNI</th>
                      <th style={{padding: '0.85rem 1rem'}}>Área</th>
                      <th style={{padding: '0.85rem 1rem', textAlign: 'right'}}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {elegibles.map(emp => (
                      <tr
                        key={emp.empleado_id}
                        style={{borderBottom: '1px solid #f1f5f9', transition: 'background 0.1s'}}
                        onMouseEnter={e => e.currentTarget.style.background = '#fafbfc'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{padding: '0.85rem 1rem', fontWeight: 500}}>{emp.nombre}</td>
                        <td style={{padding: '0.85rem 1rem', color: 'var(--text-light)'}}>{emp.dni || 'N/A'}</td>
                        <td style={{padding: '0.85rem 1rem', color: 'var(--text-light)'}}>{emp.area}</td>
                        <td style={{padding: '0.85rem 1rem', textAlign: 'right'}}>
                          <button
                            className="btn"
                            onClick={() => handleAddEmployee(emp.empleado_id)}
                            disabled={actionLoading === emp.empleado_id}
                            style={{
                              background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0',
                              fontSize: '0.78rem', padding: '0.3rem 0.65rem', borderRadius: '6px', cursor: 'pointer',
                              fontWeight: 600
                            }}
                          >
                            {actionLoading === emp.empleado_id ? '...' : '+ Agregar'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      )}

      {/* Reseñas de la Capacitación */}
      {reviews && (
        <div className="card-saas" style={{ marginTop: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Reseñas Anónimas ({reviews.total})</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#fffbeb', padding: '0.4rem 0.75rem', borderRadius: '8px', border: '1px solid #fef3c7' }}>
              <span style={{ fontSize: '1.2rem', color: '#f59e0b' }}>⭐</span>
              <span style={{ fontWeight: 700, color: '#92400e' }}>{reviews.promedio.toFixed(1)} / 5</span>
            </div>
          </div>
          
          {reviews.total === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-light)', background: 'var(--bg-main)', borderRadius: '8px' }}>
              Todavía no hay reseñas para esta capacitación.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {reviews.resenas.map(r => (
                <div key={r.id} style={{ padding: '1rem', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ color: '#f59e0b', fontSize: '1.1rem', letterSpacing: '2px' }}>
                      {'⭐'.repeat(r.estrellas)}{'☆'.repeat(5 - r.estrellas)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-light)' }}>
                      {new Date(r.fecha).toLocaleDateString()}
                    </div>
                  </div>
                  {r.comentario ? (
                    <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: '1.5' }}>"{r.comentario}"</p>
                  ) : (
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-light)', fontStyle: 'italic' }}>Sin comentario</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
