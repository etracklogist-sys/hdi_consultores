import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../utils/apiClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export default function Dashboard() {
  const navigate = useNavigate();
  const [kpis, setKpis] = useState(null);
  const [acciones, setAcciones] = useState([]);
  const [estadoClientes, setEstadoClientes] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [selectedCliente, setSelectedCliente] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async (clienteId = '') => {
    setLoading(true);
    setError(null);
    try {
      const clienteParam = clienteId ? `?cliente_id=${clienteId}` : '';
      const [resKpis, resAcciones, resClientes, resEstado] = await Promise.all([
        authFetch(`${API_URL}/dashboard/resumen${clienteParam}`),
        authFetch(`${API_URL}/dashboard/acciones`),
        authFetch(`${API_URL}/clientes/`),
        authFetch(`${API_URL}/dashboard/estado-clientes`)
      ]);

      if (!resKpis.ok || !resAcciones.ok || !resClientes.ok || !resEstado.ok) {
        throw new Error('Error en HTTP fetching dashboard');
      }

      setKpis(await resKpis.json().then(d => d.kpis));
      setAcciones(await resAcciones.json());
      setClientes(await resClientes.json());
      setEstadoClientes(await resEstado.json());
    } catch (err) {
      console.error(err);
      setError('No se pudo cargar la información del panel.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleClienteChange = (e) => {
    const val = e.target.value;
    setSelectedCliente(val);
    fetchData(val);
  };

  // --- KPI card config (operational focus) ---
  const kpiCards = [
    {
      label: 'Instancias Activas',
      value: kpis?.instancias_activas || 0,
      badge: 'En curso',
      badgeColor: '#059669',
      badgeBg: '#ECFDF5',
      icon: '⚡',
      iconBg: '#ECFDF5',
      iconColor: '#059669'
    },
    {
      label: 'Pendientes de Activación',
      value: kpis?.pendientes_activacion || 0,
      badge: 'Programadas',
      badgeColor: '#F59E0B',
      badgeBg: '#FFFBEB',
      icon: '📅',
      iconBg: '#FFFBEB',
      iconColor: '#F59E0B'
    },
    {
      label: 'Asignaciones Pendientes',
      value: kpis?.asignaciones_pendientes || 0,
      badge: 'Por completar',
      badgeColor: '#3B82F6',
      badgeBg: '#EFF6FF',
      icon: '📋',
      iconBg: '#EFF6FF',
      iconColor: '#3B82F6'
    },
    {
      label: '% Cumplimiento',
      value: `${kpis?.pct_cumplimiento || 0}%`,
      badge: kpis?.pct_cumplimiento >= 80 ? 'Bueno' : kpis?.pct_cumplimiento >= 40 ? 'Regular' : 'Bajo',
      badgeColor: kpis?.pct_cumplimiento >= 80 ? '#059669' : kpis?.pct_cumplimiento >= 40 ? '#F59E0B' : '#EF4444',
      badgeBg: kpis?.pct_cumplimiento >= 80 ? '#ECFDF5' : kpis?.pct_cumplimiento >= 40 ? '#FFFBEB' : '#FEF2F2',
      icon: '✅',
      iconBg: '#F0FDF4',
      iconColor: '#059669'
    }
  ];

  const accionLabel = (a) => {
    if (a.tipo === 'evaluacion_fallida') return 'Reintentar';
    if (a.tipo === 'certificado_venciendo') return 'Reasignar';
    return 'Ver';
  };

  const accionColor = (a) => {
    if (a.tipo === 'evaluacion_fallida') return { bg: '#F1F5F9', color: '#334155' };
    if (a.tipo === 'certificado_venciendo') return { bg: '#3B82F6', color: '#FFFFFF' };
    return { bg: '#F0FDF4', color: '#166534' };
  };

  const clienteObj = clientes.find(c => c.id === parseInt(selectedCliente));
  const clienteFilterActive = !!selectedCliente;
  const totalEmpleados = kpis?.total_empleados || 0;

  // --- Dynamic next-step logic ---
  const getNextStep = () => {
    if (totalEmpleados === 0) {
      return {
        icon: '👥',
        title: clienteFilterActive
          ? 'Este cliente no tiene empleados cargados'
          : 'No hay empleados registrados en el sistema',
        description: clienteFilterActive
          ? 'Cargá empleados para poder asignar capacitaciones.'
          : 'Comenzá agregando empleados a tus clientes.',
        actionLabel: 'Cargar empleados',
        actionRoute: clienteFilterActive ? `/admin/clientes/${selectedCliente}` : '/admin/empleados',
        color: '#3B82F6'
      };
    }
    if ((kpis?.instancias_activas || 0) === 0 && (kpis?.pendientes_activacion || 0) === 0) {
      return {
        icon: '📅',
        title: 'No hay capacitaciones planificadas',
        description: 'Creá un Plan Anual para un cliente y las instancias se generarán automáticamente.',
        actionLabel: 'Ver clientes',
        actionRoute: '/admin/clientes',
        color: '#3B82F6'
      };
    }
    if (acciones.length > 0) return null; // Show real acciones list
    if ((kpis?.asignaciones_pendientes || 0) > 0) {
      return {
        icon: '⏳',
        title: `${kpis.asignaciones_pendientes} asignación${kpis.asignaciones_pendientes > 1 ? 'es' : ''} en curso`,
        description: 'Los empleados están completando sus capacitaciones.',
        actionLabel: 'Ver vencimientos',
        actionRoute: '/admin/vencimientos',
        color: '#3B82F6'
      };
    }
    return {
      icon: '✅',
      title: 'Sin acciones pendientes',
      description: 'Todas las asignaciones están completadas.',
      actionLabel: null,
      actionRoute: null,
      color: '#059669'
    };
  };

  return (
    <div>
      {/* Header */}
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem'}}>
        <div>
          <h2 style={{margin: 0, fontSize: '1.35rem', fontWeight: 700, letterSpacing: '-0.02em'}}>
            Dashboard Operativo
            {clienteFilterActive && clienteObj && (
              <span style={{fontWeight: 400, fontSize: '0.85rem', color: 'var(--text-light)', marginLeft: '0.75rem'}}>
                — {clienteObj.razon_social}
              </span>
            )}
          </h2>
          <p style={{margin: '0.25rem 0 0', color: 'var(--text-light)', fontSize: '0.85rem'}}>
            {kpis
              ? `${kpis.total_clientes} clientes · ${kpis.total_empleados} empleados activos`
              : 'Cargando...'}
          </p>
        </div>
        <select
          value={selectedCliente}
          onChange={handleClienteChange}
          style={{
            padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)',
            background: '#fff', fontSize: '0.85rem', fontWeight: 500, minWidth: '200px', cursor: 'pointer'
          }}
        >
          <option value="">Todos los clientes</option>
          {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
        </select>
      </div>

      {error && (
        <div style={{padding: '0.75rem 1rem', marginBottom: '1.5rem', background: '#FEF2F2', color: '#DC2626', borderRadius: '8px', border: '1px solid #FECACA', fontSize: '0.85rem'}}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{padding: '4rem', textAlign: 'center', color: 'var(--text-light)'}}>
          <div style={{fontSize: '2rem', marginBottom: '0.5rem'}}>⏳</div>
          Cargando métricas operativas...
        </div>
      ) : (
        <>
          {/* ─── KPI Cards Grid ─── */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem'
          }}>
            {kpiCards.map((card, i) => (
              <div
                key={i}
                style={{
                  background: '#fff', borderRadius: '14px', padding: '1.25rem',
                  boxShadow: 'var(--shadow-sm)', border: '1px solid var(--border-color)',
                  display: 'flex', flexDirection: 'column', gap: '0.75rem',
                  transition: 'box-shadow 0.2s, transform 0.2s', cursor: 'default'
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '10px',
                    background: card.iconBg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem'
                  }}>
                    {card.icon}
                  </div>
                  {card.badge && (
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 600, padding: '0.2rem 0.55rem',
                      borderRadius: '6px', background: card.badgeBg, color: card.badgeColor
                    }}>
                      {card.badge}
                    </span>
                  )}
                </div>
                <div style={{fontSize: '0.8rem', color: 'var(--text-light)', fontWeight: 500}}>
                  {card.label}
                </div>
                <div style={{fontSize: '2rem', fontWeight: 700, lineHeight: 1, letterSpacing: '-0.03em'}}>
                  {card.value}
                </div>
              </div>
            ))}
          </div>

          {/* ─── Two-column: Acciones + Estado por Cliente ─── */}
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem'}}>

            {/* LEFT: Acciones Requeridas */}
            <div style={{
              background: '#fff', borderRadius: '14px', border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-sm)', overflow: 'hidden', display: 'flex', flexDirection: 'column'
            }}>
              <div style={{padding: '1.25rem 1.25rem 0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                <h3 style={{margin: 0, fontSize: '1rem', fontWeight: 700}}>
                  {(() => { const ns = getNextStep(); return ns && !ns.actionLabel ? 'Estado Actual' : 'Acciones Requeridas'; })()}
                </h3>
                {acciones.length > 0 && (
                  <button
                    onClick={() => navigate('/admin/vencimientos')}
                    style={{background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-light)', fontSize: '0.8rem', fontWeight: 500}}
                  >
                    Ver todo →
                  </button>
                )}
              </div>

              <div style={{flex: 1, overflowY: 'auto'}}>
                {(() => {
                  const nextStep = getNextStep();
                  if (nextStep) {
                    return (
                      <div style={{padding: '1.5rem 1.25rem', textAlign: 'center'}}>
                        <div style={{fontSize: '2rem', marginBottom: '0.75rem'}}>{nextStep.icon}</div>
                        <div style={{fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.35rem', color: 'var(--text-dark)'}}>
                          {nextStep.title}
                        </div>
                        <div style={{fontSize: '0.82rem', color: 'var(--text-light)', marginBottom: '1rem', lineHeight: 1.5}}>
                          {nextStep.description}
                        </div>
                        {nextStep.actionLabel && (
                          <button
                            onClick={() => navigate(nextStep.actionRoute)}
                            style={{
                              background: nextStep.color, color: '#fff', border: 'none',
                              padding: '0.55rem 1.25rem', borderRadius: '8px',
                              fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer'
                            }}
                          >
                            {nextStep.actionLabel}
                          </button>
                        )}
                      </div>
                    );
                  }
                  return acciones.map((a, idx) => {
                    const colors = accionColor(a);
                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.75rem',
                          padding: '0.85rem 1.25rem',
                          borderBottom: idx < acciones.length - 1 ? '1px solid #f1f5f9' : 'none',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#fafbfc'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{
                          width: '36px', height: '36px', borderRadius: '50%',
                          background: `linear-gradient(135deg, ${card_gradient(idx)})`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#fff', fontWeight: 700, fontSize: '0.8rem', flexShrink: 0
                        }}>
                          {a.empleado_nombre?.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <div style={{flex: 1, minWidth: 0}}>
                          <div style={{fontWeight: 600, fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                            {a.empleado_nombre}
                          </div>
                          <div style={{fontSize: '0.75rem', color: 'var(--text-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'}}>
                            {a.cliente_nombre} · {a.capacitacion}
                          </div>
                        </div>
                        <span style={{
                          padding: '0.25rem 0.65rem', borderRadius: '6px',
                          fontSize: '0.72rem', fontWeight: 600,
                          background: colors.bg, color: colors.color, whiteSpace: 'nowrap', flexShrink: 0
                        }}>
                          {accionLabel(a)}
                        </span>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* RIGHT: Estado por Cliente */}
            <div style={{
              background: '#fff', borderRadius: '14px', border: '1px solid var(--border-color)',
              boxShadow: 'var(--shadow-sm)', overflow: 'hidden', display: 'flex', flexDirection: 'column'
            }}>
              <div style={{padding: '1.25rem 1.25rem 0.75rem'}}>
                <h3 style={{margin: 0, fontSize: '1rem', fontWeight: 700}}>Estado por Cliente</h3>
              </div>

              <div style={{flex: 1, overflowY: 'auto'}}>
                {estadoClientes.length === 0 ? (
                  <div style={{padding: '1.5rem 1.25rem', textAlign: 'center'}}>
                    <div style={{fontSize: '2rem', marginBottom: '0.75rem'}}>📊</div>
                    <div style={{fontWeight: 600, fontSize: '0.95rem', marginBottom: '0.35rem', color: 'var(--text-dark)'}}>
                      {totalEmpleados === 0 ? 'Sin clientes o empleados' : 'Sin asignaciones registradas'}
                    </div>
                    <div style={{fontSize: '0.82rem', color: 'var(--text-light)', marginBottom: '1rem', lineHeight: 1.5}}>
                      {totalEmpleados === 0
                        ? 'Agregá clientes y empleados para ver el estado de avance.'
                        : 'Creá un Plan Anual para generar instancias y asignaciones.'}
                    </div>
                    <button
                      onClick={() => navigate('/admin/clientes')}
                      style={{
                        background: '#3B82F6', color: '#fff', border: 'none',
                        padding: '0.55rem 1.25rem', borderRadius: '8px',
                        fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer'
                      }}
                    >
                      {totalEmpleados === 0 ? 'Agregar clientes' : 'Ver clientes'}
                    </button>
                  </div>
                ) : (
                  estadoClientes.map((c, idx) => (
                    <div
                      key={c.id}
                      style={{
                        padding: '1rem 1.25rem',
                        borderBottom: idx < estadoClientes.length - 1 ? '1px solid #f1f5f9' : 'none',
                        cursor: 'pointer', transition: 'background 0.15s'
                      }}
                      onClick={() => navigate(`/admin/clientes/${c.id}`)}
                      onMouseEnter={e => e.currentTarget.style.background = '#fafbfc'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem'}}>
                        <span style={{fontWeight: 600, fontSize: '0.9rem'}}>{c.razon_social}</span>
                        <span style={{
                          fontWeight: 700, fontSize: '0.8rem',
                          color: c.porcentaje >= 80 ? '#059669' : c.porcentaje >= 40 ? '#F59E0B' : '#EF4444'
                        }}>
                          {c.porcentaje}%
                        </span>
                      </div>
                      <div style={{height: '5px', background: '#F1F5F9', borderRadius: '3px', marginBottom: '0.6rem', overflow: 'hidden'}}>
                        <div style={{
                          height: '100%', width: `${c.porcentaje}%`, borderRadius: '3px',
                          background: c.porcentaje >= 80
                            ? 'linear-gradient(90deg, #10B981, #059669)'
                            : c.porcentaje >= 40
                              ? 'linear-gradient(90deg, #FBBF24, #F59E0B)'
                              : 'linear-gradient(90deg, #F87171, #EF4444)',
                          transition: 'width 0.5s ease'
                        }} />
                      </div>
                      <div style={{display: 'flex', gap: '1.5rem', fontSize: '0.78rem'}}>
                        <div><span style={{color: 'var(--text-light)'}}>Total </span><span style={{fontWeight: 600}}>{c.total}</span></div>
                        <div><span style={{color: 'var(--text-light)'}}>Pend. </span><span style={{fontWeight: 600, color: '#EF4444'}}>{c.pendientes}</span></div>
                        <div><span style={{color: 'var(--text-light)'}}>Comp. </span><span style={{fontWeight: 600, color: '#059669'}}>{c.completadas}</span></div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Helper: gradient colors for avatar initials
function card_gradient(index) {
  const gradients = [
    '#667eea, #764ba2', '#f093fb, #f5576c', '#4facfe, #00f2fe',
    '#43e97b, #38f9d7', '#fa709a, #fee140', '#a18cd1, #fbc2eb',
    '#fccb90, #d57eeb', '#e0c3fc, #8ec5fc'
  ];
  return gradients[index % gradients.length];
}
