import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { authFetch } from '../utils/apiClient';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export default function PlanAnual() {
  const { id: cliente_id } = useParams();
  const navigate = useNavigate();
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [catalogo, setCatalogo] = useState([]);

  // Draft tracking: savedItems is the last-known server state of items
  const [savedItems, setSavedItems] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [justSaved, setJustSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const justSavedTimer = useRef(null);

  // Modals
  const [showItemModal, setShowItemModal] = useState(false);
  const [selectedMes, setSelectedMes] = useState(1);
  const [selectedTipo, setSelectedTipo] = useState("ANUAL");
  const [selectedCap, setSelectedCap] = useState("");
  const [notification, setNotification] = useState(null);
  const [previewModal, setPreviewModal] = useState({ show: false, programada: null, data: null, loading: false });
  const [editProgModal, setEditProgModal] = useState({ show: false, p: null });

  const MESES_NOMBRES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const getMesNombre = (m) => MESES_NOMBRES[m - 1] || `Mes ${m}`;
  const currentMonth = new Date().getMonth() + 1;

  const formatTimestamp = (iso) => {
    if (!iso) return null;
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return iso.substring(0, 16); }
  };

  // ── Dirty detection ──
  const itemsFingerprint = useCallback((items) => {
    if (!items) return '';
    return JSON.stringify(
      items.map(it => ({ c: it.capacitacion_id, m: it.mes, t: it.tipo, a: it.activo }))
        .sort((a, b) => a.c - b.c || a.m - b.m || a.t.localeCompare(b.t))
    );
  }, []);

  const isDirty = savedItems !== null && itemsFingerprint(data?.items) !== itemsFingerprint(savedItems);

  // ── Data loading ──
  const loadData = async () => {
    setLoading(true);
    try {
      const res = await authFetch(`${API_URL}/plan-anual/${cliente_id}/${anio}`);
      if (!res.ok) { const text = await res.text(); throw new Error(`HTTP ${res.status}: ${text}`); }
      const planData = await res.json();
      setData(planData);
      // Store the server-truth items for dirty detection
      setSavedItems(planData.items ? JSON.parse(JSON.stringify(planData.items)) : []);
      if (planData.updated_at) setSavedAt(planData.updated_at);

      const resCli = await authFetch(`${API_URL}/clientes/${cliente_id}`);
      if (!resCli.ok) throw new Error("Error cargando cliente");
      setCliente(await resCli.json());

      const resCat = await authFetch(`${API_URL}/capacitaciones/`);
      setCatalogo(await resCat.json());
      setError(null);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [cliente_id, anio]);
  useEffect(() => () => { if (justSavedTimer.current) clearTimeout(justSavedTimer.current); }, []);

  // ── Save handler ──
  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    try {
      const res = await authFetch(`${API_URL}/plan-anual/${cliente_id}`, {
        method: "POST",
        body: JSON.stringify({
          anio, observaciones: data?.observaciones || "",
          items: (data?.items || []).map(it => ({ capacitacion_id: it.capacitacion_id, mes: it.mes, tipo: it.tipo, activo: it.activo }))
        })
      });
      if (!res.ok) { const text = await res.text(); throw new Error(`HTTP ${res.status}: ${text}`); }
      const result = await res.json();
      const { creadas, actualizadas } = result.generacion || {};
      const errores = result.errores || [];

      let msg = `Plan guardado. ${creadas || 0} instancias creadas, ${actualizadas || 0} actualizadas.`;
      if (errores.length > 0) msg += ` ⚠️ ${errores.length} error(es): ${errores.join('; ')}`;

      setNotification({ type: errores.length > 0 ? 'warning' : 'success', text: msg });
      setJustSaved(true);
      if (justSavedTimer.current) clearTimeout(justSavedTimer.current);
      justSavedTimer.current = setTimeout(() => setJustSaved(false), 5000);

      // Reload server truth
      await loadData();
    } catch (err) {
      setNotification({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  // ── Plan item manipulation ──
  const addItemToPlan = () => {
    if (!selectedCap) return alert("Selecciona una capacitación");
    const newItems = [...(data.items || [])];
    newItems.push({
      capacitacion_id: parseInt(selectedCap),
      nombre_capacitacion: catalogo.find(c => c.id === parseInt(selectedCap))?.nombre || "N/A",
      mes: selectedMes, tipo: selectedTipo, activo: true
    });
    setData({ ...data, items: newItems });
    setShowItemModal(false);
  };

  const removeItem = (index) => {
    const newItems = [...data.items];
    newItems.splice(index, 1);
    setData({ ...data, items: newItems });
  };

  // ── Execution action handlers ──
  const openPreviewModal = async (p) => {
    setPreviewModal({ show: true, programada: p, data: null, loading: true });
    setNotification(null);
    try {
      const res = await authFetch(`${API_URL}/plan-anual/programadas/${p.id}/preview`);
      if (!res.ok) throw new Error("Error cargando previsualización");
      setPreviewModal({ show: true, programada: p, data: await res.json(), loading: false });
    } catch (err) {
      setNotification({ type: 'error', text: err.message });
      setPreviewModal({ show: false, programada: null, data: null, loading: false });
    }
  };

  const confirmActivate = async () => {
    const p = previewModal.programada;
    if (!p) return;
    try {
      setPreviewModal(prev => ({ ...prev, loading: true }));
      const res = await authFetch(`${API_URL}/plan-anual/programadas/activar`, {
        method: "POST",
        body: JSON.stringify({ programada_id: p.id, alcance: "TODOS", empleados_ids: [] })
      });
      if (!res.ok) { const text = await res.text(); throw new Error(`HTTP ${res.status}: ${text}`); }
      const result = await res.json();
      setNotification({ type: 'success', text: `Activada. ${result.asignados} asignaciones generadas.` });
      setPreviewModal({ show: false, programada: null, data: null, loading: false });
      loadData();
    } catch (err) {
      setNotification({ type: 'error', text: err.message });
      setPreviewModal({ show: false, programada: null, data: null, loading: false });
    }
  };

  const handleFinalizar = async (prog_id) => {
    if (!confirm("¿Finalizar esta capacitación? Se marcará como completada.")) return;
    try {
      const res = await authFetch(`${API_URL}/plan-anual/programadas/${prog_id}/finalizar`, { method: "POST" });
      if (!res.ok) { const text = await res.text(); throw new Error(`HTTP ${res.status}: ${text}`); }
      loadData();
      setNotification({ type: 'success', text: "Capacitación finalizada." });
    } catch (err) { setNotification({ type: 'error', text: err.message }); }
  };

  const handleCancelar = async (prog_id) => {
    if (!confirm("¿Cancelar esta capacitación? Permanecerá visible en el historial.")) return;
    try {
      const res = await authFetch(`${API_URL}/plan-anual/programadas/${prog_id}/cancelar`, { method: "POST" });
      if (!res.ok) { const text = await res.text(); throw new Error(`HTTP ${res.status}: ${text}`); }
      loadData();
      setNotification({ type: 'success', text: "Capacitación cancelada." });
    } catch (err) { setNotification({ type: 'error', text: err.message }); }
  };

  const handleEliminar = async (prog_id) => {
    if (!confirm("¿Eliminar esta capacitación programada permanentemente? Solo se permite si no tiene asignaciones.")) return;
    try {
      const res = await authFetch(`${API_URL}/plan-anual/programadas/${prog_id}`, { method: "DELETE" });
      if (!res.ok) { const text = await res.text(); throw new Error(`HTTP ${res.status}: ${text}`); }
      loadData();
      setNotification({ type: 'success', text: "Capacitación eliminada." });
    } catch (err) { setNotification({ type: 'error', text: err.message }); }
  };

  const saveProgramadaInfo = async () => {
    try {
      const p = editProgModal.p;
      const res = await authFetch(`${API_URL}/plan-anual/programadas/${p.id}`, {
        method: "PUT",
        body: JSON.stringify({ fecha_programada: p.fecha_programada || "", modalidad_final: p.modalidad_final, requiere_evaluacion_final: p.requiere_evaluacion_final })
      });
      if (!res.ok) throw new Error("Error guardando datos");
      setNotification({ type: 'success', text: "Instancia actualizada." });
      setEditProgModal({ show: false, p: null });
      loadData();
    } catch (err) { setNotification({ type: 'error', text: err.message }); }
  };

  // ── Render helpers ──
  const renderBadge = (tipo) => {
    const styles = { ANUAL: { background: 'var(--primary-color)', color: 'white' }, COMPLEMENTARIA: { background: '#0d9488', color: 'white' }, EVENTUAL: { background: '#d97706', color: 'white' }, LEGACY: { background: '#64748b', color: 'white' } };
    return <span className="badge" style={styles[tipo] || {}}>{tipo}</span>;
  };

  const ProgressBar = ({ current, total }) => (
    <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
      <div style={{flex: 1, height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', minWidth: '60px'}}>
        <div style={{width: total > 0 ? `${Math.min((current/total)*100, 100)}%` : '0%', height: '100%', background: 'var(--accent-green)', borderRadius: '3px', transition: 'width 0.3s'}} />
      </div>
      <span style={{fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap'}}>{current} / {total}</span>
    </div>
  );

  // ── Loading / Error ──
  if (loading) return <div style={{padding: '2rem'}}>Cargando plan anual...</div>;
  if (error) return <div style={{padding: '2rem', color: '#c00'}}>{error}</div>;

  if (data?.estado === "NO_EXISTE") {
    return (
      <div style={{padding: '2rem', textAlign: 'center'}}>
        <Link to={`/admin/clientes/${cliente_id}`} style={{color: 'var(--text-light)', textDecoration: 'none', marginBottom: '2rem', display: 'inline-block'}}>← Volver a Cliente</Link>
        <h2 style={{marginTop: 0}}>Plan Anual de Capacitación</h2>
        <p style={{color: 'var(--text-light)', marginBottom: '2rem'}}>Este cliente aún no tiene un plan anual configurado.</p>
        <button className="btn btn-primary" onClick={handleSave}>Crear Plan Anual</button>
      </div>
    );
  }

  const meses = [1,2,3,4,5,6,7,8,9,10,11,12];

  // ── Classify programadas ──
  // Note: backend normalizes CERRADA → FINALIZADA, but we add a safety net here too
  const programadas = data.programadas || [];
  const activas = programadas.filter(p => p.estado === 'ACTIVA').sort((a,b) => a.mes - b.mes);
  const proximas = programadas.filter(p => p.estado === 'PROGRAMADA').sort((a,b) => a.mes - b.mes);
  const historial = programadas.filter(p => p.estado === 'FINALIZADA' || p.estado === 'CANCELADA' || p.estado === 'CERRADA').sort((a,b) => a.mes - b.mes);

  // ── Plan status indicator ──
  const planStatus = justSaved ? 'saved' : isDirty ? 'dirty' : 'clean';
  const planStatusLabel = {
    saved: { text: '✓ Guardado', color: '#166534', bg: '#dcfce7' },
    dirty: { text: '● Cambios sin guardar', color: '#92400e', bg: '#fef3c7' },
    clean: { text: 'Sin cambios', color: '#64748b', bg: '#f1f5f9' }
  }[planStatus];

  // ── ProgramadaCard ──
  const ProgramadaCard = ({ p, section }) => {
    const [menuOpen, setMenuOpen] = useState(false);
    const [hovered, setHovered] = useState(false);
    const detailUrl = `/admin/clientes/${cliente_id}/programadas/${p.id}`;

    return (
      <div
        style={{
          background: section === 'history' ? '#fafbfc' : 'white',
          border: `1px solid ${hovered && section !== 'upcoming' ? 'var(--primary-color)' : '#e2e8f0'}`,
          borderRadius: '10px', padding: '1rem 1.25rem',
          display: 'flex', alignItems: 'center', gap: '1rem',
          position: 'relative', opacity: section === 'history' ? 0.85 : 1,
          transition: 'border-color 0.15s, box-shadow 0.15s',
          boxShadow: hovered && section !== 'upcoming' ? '0 2px 8px rgba(0,0,0,0.06)' : 'none',
          cursor: section !== 'upcoming' ? 'pointer' : 'default'
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={(e) => {
          // Don't navigate if clicking a button/menu
          if (e.target.closest('button') || e.target.closest('[data-menu]')) return;
          if (section !== 'upcoming') navigate(detailUrl);
        }}
      >
        <div style={{flex: 1, minWidth: 0}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.3rem'}}>
            <span style={{fontWeight: 600, fontSize: '0.95rem'}}>{p.nombre}</span>
          </div>
          <div style={{display: 'flex', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-light)', flexWrap: 'wrap', alignItems: 'center'}}>
            <span>{getMesNombre(p.mes)} {anio}</span>
            <span>·</span>
            {renderBadge(p.tipo)}
            <span>·</span>
            <span style={{fontWeight: 600, color: p.estado === 'ACTIVA' ? '#166534' : 'inherit'}}>{p.estado}</span>
            {section === 'history' && (
              <>
                <span>·</span>
                <span style={{
                  fontSize: '0.75rem', fontWeight: 600, padding: '0.15rem 0.5rem', borderRadius: '10px',
                  background: p.estado === 'FINALIZADA' ? '#dcfce7' : '#fef2f2',
                  color: p.estado === 'FINALIZADA' ? '#166534' : '#991b1b'
                }}>
                  {p.estado === 'FINALIZADA' ? '✓ Finalizada' : '✕ Cancelada'}
                </span>
              </>
            )}
          </div>
          <div style={{display: 'flex', gap: '0.75rem', fontSize: '0.8rem', color: 'var(--text-light)', flexWrap: 'wrap', marginTop: '0.3rem'}}>
            <span>{p.modalidad_final}</span>
            <span>{p.requiere_evaluacion_final ? 'Con evaluación' : 'Sin evaluación'}</span>
            {p.fecha_programada && <span>📅 {p.fecha_programada.substring(0,10)}</span>}
          </div>
          {section === 'active' && p.fecha_activacion && (
            <div style={{fontSize: '0.75rem', color: '#059669', marginTop: '0.3rem'}}>
              Activada automáticamente el {formatTimestamp(p.fecha_activacion)}
            </div>
          )}
          {section === 'upcoming' && (
            <div style={{fontSize: '0.75rem', color: '#92400e', marginTop: '0.3rem', fontStyle: 'italic'}}>
              {p.mes <= currentMonth
                ? '⏳ Mes alcanzado — se activará en el próximo ciclo de activación'
                : `Se activará automáticamente en ${getMesNombre(p.mes)}`
              }
            </div>
          )}
          {section === 'history' && p.fecha_cierre && (
            <div style={{fontSize: '0.75rem', color: '#6b7280', marginTop: '0.3rem'}}>
              {p.estado === 'FINALIZADA' ? 'Finalizada' : 'Cancelada'} el {formatTimestamp(p.fecha_cierre)}
            </div>
          )}
        </div>

        <div style={{width: '150px', flexShrink: 0}}>
          {section === 'active' && (
            <>
              <div style={{fontSize: '0.7rem', color: 'var(--text-light)', marginBottom: '0.2rem', textTransform: 'uppercase', fontWeight: 600}}>Asignados</div>
              <ProgressBar current={p.total_asignados} total={p.total_elegibles} />
            </>
          )}
          {section === 'upcoming' && (
            <span style={{fontSize: '0.8rem', color: '#94a3b8'}}>{p.total_elegibles} elegible{p.total_elegibles !== 1 ? 's' : ''}</span>
          )}
          {section === 'history' && (
            <span style={{fontSize: '0.8rem', color: '#94a3b8'}}>{p.total_asignados} asignado{p.total_asignados !== 1 ? 's' : ''}</span>
          )}
        </div>

        {/* CTA: Ver detalle for active & history */}
        {section !== 'upcoming' && (
          <button
            onClick={(e) => { e.stopPropagation(); navigate(detailUrl); }}
            style={{
              background: section === 'active' ? 'var(--primary-color)' : 'transparent',
              color: section === 'active' ? 'white' : 'var(--text-light)',
              border: section === 'active' ? 'none' : '1px solid #e2e8f0',
              padding: '0.4rem 0.85rem', borderRadius: '6px',
              cursor: 'pointer', fontSize: '0.82rem', fontWeight: 500,
              whiteSpace: 'nowrap', flexShrink: 0
            }}
          >
            Ver detalle →
          </button>
        )}

        {section !== 'history' && (
          <div style={{position: 'relative', flexShrink: 0}} data-menu>
            <button onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }} style={{background: 'none', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.35rem 0.6rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-light)'}}>⋮</button>
            {menuOpen && (
              <div style={{position: 'absolute', right: 0, top: '100%', marginTop: '0.25rem', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 10, minWidth: '200px', overflow: 'hidden'}}>
                <button style={{width: '100%', padding: '0.6rem 1rem', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '0.85rem', borderBottom: '1px solid #f1f5f9'}}
                  onClick={() => { setMenuOpen(false); setEditProgModal({show: true, p: {...p}}); }}>✍️ Configurar instancia</button>
                {p.can_activate_manual && (
                  <button style={{width: '100%', padding: '0.6rem 1rem', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--primary-color)', borderBottom: '1px solid #f1f5f9'}}
                    onClick={() => { setMenuOpen(false); openPreviewModal(p); }}>⚡ Activar manualmente</button>
                )}
                {p.can_finalize && (
                  <button style={{width: '100%', padding: '0.6rem 1rem', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '0.85rem', color: '#059669', borderBottom: '1px solid #f1f5f9'}}
                    onClick={() => { setMenuOpen(false); handleFinalizar(p.id); }}>✓ Finalizar</button>
                )}
                {p.can_cancel && (
                  <button style={{width: '100%', padding: '0.6rem 1rem', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '0.85rem', color: '#d97706', borderBottom: '1px solid #f1f5f9'}}
                    onClick={() => { setMenuOpen(false); handleCancelar(p.id); }}>✕ Cancelar</button>
                )}
                {p.can_delete && (
                  <button style={{width: '100%', padding: '0.6rem 1rem', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontSize: '0.85rem', color: '#dc2626'}}
                    onClick={() => { setMenuOpen(false); handleEliminar(p.id); }}>🗑️ Eliminar</button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ═══════════════ RENDER ═══════════════

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', alignItems: 'center' }}>
        <div>
          <Link to={`/admin/clientes/${cliente_id}`} style={{color: 'var(--text-light)', textDecoration: 'none', marginBottom: '0.5rem', display: 'inline-block'}}>← Volver a Cliente</Link>
          <h2 style={{margin: 0}}>Plan Anual de Capacitación</h2>
          <p style={{color: 'var(--text-light)', margin: '0.5rem 0 0'}}>Cliente: <strong>{cliente?.razon_social}</strong></p>
        </div>
        <div style={{display: 'flex', gap: '0.5rem', alignItems: 'center'}}>
                    <button
            className="btn btn-outline"
            onClick={() => {
              const url = `${API_URL}/plan-anual/${cliente_id}/${anio}/pdf`;
              window.open(url, '_blank');
            }}
            title="Descargar Plan Anual en PDF"
            style={{marginRight: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem'}}
          >
            📄 PDF
          </button>
          <button className="btn btn-outline" onClick={() => setAnio(anio - 1)}>◄</button>
          <span style={{fontSize: '1.25rem', fontWeight: 600, padding: '0 1rem'}}>{anio}</span>
          <button className="btn btn-outline" onClick={() => setAnio(anio + 1)}>►</button>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div style={{
          padding: '1rem', marginBottom: '1.5rem', borderRadius: '8px',
          background: notification.type === 'error' ? '#fee2e2' : notification.type === 'warning' ? '#fef3c7' : '#dcfce7',
          color: notification.type === 'error' ? '#991b1b' : notification.type === 'warning' ? '#92400e' : '#166534',
          border: `1px solid ${notification.type === 'error' ? '#f87171' : notification.type === 'warning' ? '#fcd34d' : '#86efac'}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <span>{notification.text}</span>
          <button onClick={() => setNotification(null)} style={{background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: 'inherit'}}>×</button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
           BLOCK 1: PLAN EDITOR (draft state)
         ═══════════════════════════════════════════════════════════════ */}
      <div className="card" style={{marginBottom: '0', borderBottom: isDirty ? '3px solid #f59e0b' : undefined}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem', gap: '1rem', flexWrap: 'wrap'}}>
          <div style={{flex: 1, minWidth: '250px'}}>
            <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.3rem'}}>
              <h3 style={{margin: 0, fontSize: '1.05rem'}}>📋 Planificación del Año {anio}</h3>
              <span style={{
                fontSize: '0.75rem', fontWeight: 600, padding: '0.2rem 0.6rem', borderRadius: '10px',
                background: planStatusLabel.bg, color: planStatusLabel.color
              }}>{planStatusLabel.text}</span>
            </div>
            <p style={{margin: '0.2rem 0 0', fontSize: '0.8rem', color: 'var(--text-light)'}}>
              Lo que debería ocurrir. Los cambios aquí no afectan la ejecución hasta que guardes el plan.
              <br/>
              <strong>Al activarse el mes, se generará una instancia operativa de esta capacitación.</strong>
            </p>
            {savedAt && (
              <p style={{margin: '0.2rem 0 0', fontSize: '0.75rem', color: '#94a3b8'}}>
                Último guardado: {formatTimestamp(savedAt)}
              </p>
            )}
          </div>
          <button
            className={`btn ${isDirty ? 'btn-primary' : 'btn-outline'}`}
            onClick={handleSave}
            disabled={saving}
            style={isDirty ? {animation: 'none', fontWeight: 600} : {opacity: 0.6}}
          >
            {saving ? 'Guardando...' : isDirty ? '💾 Guardar Plan y Regenerar' : 'Guardar Plan'}
          </button>
        </div>

        <div style={{display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginTop: '1rem'}}>
          {meses.map(m => {
            const itemsMes = data?.items?.filter(it => it.mes === m) || [];
            const isPast = m < currentMonth;
            return (
              <div key={m} style={{
                border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem',
                background: isPast ? '#f8fafc' : '#f8fafc',
                opacity: 1
              }}>
                <div style={{display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem', marginBottom: '0.5rem'}}>
                  <strong style={{color: m === currentMonth ? 'var(--primary-color)' : 'var(--text-main)', fontSize: '0.9rem'}}>
                    {getMesNombre(m)}
                    {m === currentMonth && <span style={{fontSize: '0.7rem', marginLeft: '0.3rem', fontWeight: 400}}>← hoy</span>}
                  </strong>
                  <button onClick={() => { setSelectedMes(m); setShowItemModal(true); }} style={{background: 'none', border: 'none', color: 'var(--primary-color)', cursor: 'pointer', fontWeight: 600}}>+</button>
                </div>
                <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
                  {itemsMes.map((it, idx) => (
                    <div key={idx} style={{background: 'white', border: '1px solid #e2e8f0', padding: '0.5rem', borderRadius: '4px', fontSize: '0.85rem'}}>
                      <div style={{display: 'flex', justifyContent: 'space-between'}}>
                        <span style={{fontWeight: 500}}>{it.nombre_capacitacion}</span>
                        <div style={{cursor: 'pointer', color: '#c00'}} onClick={() => removeItem(data.items.indexOf(it))}>×</div>
                      </div>
                      <div style={{marginTop: '0.25rem'}}>{renderBadge(it.tipo)}</div>
                    </div>
                  ))}
                  {itemsMes.length === 0 && <span style={{color: '#94a3b8', fontSize: '0.8rem'}}>Sin planificar</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
           UNSAVED CHANGES BANNER (between plan and execution)
         ═══════════════════════════════════════════════════════════════ */}
      {isDirty && (
        <div style={{
          margin: '0 0 0 0', padding: '0.75rem 1.25rem', borderRadius: '0 0 8px 8px',
          background: '#fef3c7', border: '1px solid #fcd34d', borderTop: 'none',
          display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem', color: '#92400e'
        }}>
          <span style={{fontSize: '1.1rem'}}>⚠️</span>
          <span><strong>Cambios sin guardar.</strong> La ejecución de abajo refleja el último plan guardado, no tus cambios actuales.</span>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{marginLeft: 'auto', padding: '0.3rem 0.75rem', fontSize: '0.8rem'}}>
            {saving ? '...' : 'Guardar ahora'}
          </button>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
           BLOCK 2: EJECUCIÓN REAL (server truth only)
         ═══════════════════════════════════════════════════════════════ */}
      <div style={{marginTop: isDirty ? '0' : '2rem', marginBottom: '0.5rem'}}>
        <h3 style={{margin: 0, fontSize: '1.05rem'}}>⚡ Ejecución de Capacitaciones</h3>
        <p style={{margin: '0.2rem 0 1.25rem', fontSize: '0.8rem', color: 'var(--text-light)'}}>
          Estado real generado a partir del último plan guardado. Esta sección se actualiza solo al guardar el plan.
        </p>
      </div>

      {programadas.length === 0 ? (
        <div className="card" style={{textAlign: 'center', padding: '3rem 2rem', color: '#94a3b8'}}>
          <div style={{fontSize: '2rem', marginBottom: '0.75rem'}}>📋</div>
          <p style={{margin: 0, fontSize: '0.95rem'}}>No hay instancias generadas para {anio}.</p>
          <p style={{margin: '0.5rem 0 0', fontSize: '0.85rem'}}>
            {data?.items?.length > 0
              ? 'Guardá el plan de arriba para generar las instancias de ejecución.'
              : 'Agregá capacitaciones al plan y guardá para generar instancias.'
            }
          </p>
        </div>
      ) : (
        <div style={{display: 'flex', flexDirection: 'column', gap: '1.25rem'}}>

          {/* 🟢 ACTIVAS */}
          <div className="card" style={{padding: 0, overflow: 'visible'}}>
            <div style={{padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
              <span style={{width: '10px', height: '10px', borderRadius: '50%', background: '#22c55e', display: 'inline-block', flexShrink: 0}} />
              <div style={{flex: 1}}>
                <h4 style={{margin: 0, fontSize: '0.95rem'}}>Activas — En curso</h4>
                <p style={{margin: '0.15rem 0 0', fontSize: '0.78rem', color: 'var(--text-light)'}}>Asignaciones generadas · Los empleados pueden acceder</p>
              </div>
              {activas.length > 0 && <span style={{background: '#dcfce7', color: '#166534', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600}}>{activas.length}</span>}
            </div>
            <div style={{padding: '1rem 1.25rem'}}>
              {activas.length > 0 ? (
                <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
                  {activas.map(p => <ProgramadaCard key={p.id} p={p} section="active" />)}
                </div>
              ) : (
                <div style={{textAlign: 'center', padding: '1.25rem', color: '#94a3b8', fontSize: '0.88rem'}}>
                  {proximas.length > 0
                    ? `No hay capacitaciones activas ahora. ${proximas.length} próxima${proximas.length !== 1 ? 's' : ''} se activará${proximas.length !== 1 ? 'n' : ''} automáticamente.`
                    : 'No hay capacitaciones activas para este año.'}
                </div>
              )}
            </div>
          </div>

          {/* 🟡 PRÓXIMAS */}
          <div className="card" style={{padding: 0, overflow: 'visible'}}>
            <div style={{padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
              <span style={{width: '10px', height: '10px', borderRadius: '50%', background: '#f59e0b', display: 'inline-block', flexShrink: 0}} />
              <div style={{flex: 1}}>
                <h4 style={{margin: 0, fontSize: '0.95rem'}}>Próximas — Activación automática</h4>
                <p style={{margin: '0.15rem 0 0', fontSize: '0.78rem', color: 'var(--text-light)'}}>Se activarán al llegar el mes programado · No requieren acción</p>
              </div>
              {proximas.length > 0 && <span style={{background: '#fef3c7', color: '#92400e', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600}}>{proximas.length}</span>}
            </div>
            <div style={{padding: '1rem 1.25rem'}}>
              {proximas.length > 0 ? (
                <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
                  {proximas.map(p => <ProgramadaCard key={p.id} p={p} section="upcoming" />)}
                </div>
              ) : (
                <div style={{textAlign: 'center', padding: '1.25rem', color: '#94a3b8', fontSize: '0.88rem'}}>
                  Todas las capacitaciones planificadas ya fueron activadas o no hay pendientes para {anio}.
                </div>
              )}
            </div>
          </div>

          {/* 🔴 HISTORIAL */}
          {historial.length > 0 && (
            <div className="card" style={{padding: 0, overflow: 'visible'}}>
              <div style={{padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.75rem'}}>
                <span style={{width: '10px', height: '10px', borderRadius: '50%', background: '#94a3b8', display: 'inline-block', flexShrink: 0}} />
                <div style={{flex: 1}}>
                  <h4 style={{margin: 0, fontSize: '0.95rem'}}>Historial</h4>
                  <p style={{margin: '0.15rem 0 0', fontSize: '0.78rem', color: 'var(--text-light)'}}>Finalizadas y canceladas · Solo lectura</p>
                </div>
                <span style={{background: '#f1f5f9', color: '#64748b', padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.8rem', fontWeight: 600}}>{historial.length}</span>
              </div>
              <div style={{padding: '1rem 1.25rem'}}>
                <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
                  {historial.map(p => <ProgramadaCard key={p.id} p={p} section="history" />)}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
           MODALS
         ═══════════════════════════════════════════════════════════════ */}

      {showItemModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '400px'}}>
            <h3 style={{marginTop: 0}}>Añadir a {getMesNombre(selectedMes)}</h3>
            <label>Tipo de Capacitación</label>
            <select style={{width: '100%', marginBottom: '1rem', padding: '0.5rem'}} value={selectedTipo} onChange={e => setSelectedTipo(e.target.value)}>
              <option value="ANUAL">Anual (Recurrente estándar)</option>
              <option value="COMPLEMENTARIA">Complementaria (Refuerzo/Específica)</option>
            </select>
            <label>Capacitación en Catálogo</label>
            <select style={{width: '100%', marginBottom: '1.5rem', padding: '0.5rem'}} value={selectedCap} onChange={e => setSelectedCap(e.target.value)}>
              <option value="">-- Seleccionar --</option>
              {catalogo.map(c => <option key={c.id} value={c.id}>{c.nombre} ({c.rubro?.nombre || 'General'})</option>)}
            </select>
            <div style={{display: 'flex', gap: '1rem'}}>
              <button className="btn" onClick={() => setShowItemModal(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={addItemToPlan}>Añadir al Plan</button>
            </div>
          </div>
        </div>
      )}

      {previewModal.show && previewModal.programada && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '450px'}}>
            <h3 style={{marginTop: 0}}>Activación Manual (Override)</h3>
            <p style={{color: 'var(--text-light)', fontSize: '0.85rem', marginBottom: '1rem'}}>Normalmente esto ocurre automáticamente al llegar el mes programado.</p>
            <div style={{background: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', border: '1px solid var(--border-color)'}}>
              <p style={{margin: '0 0 0.5rem 0'}}><strong>Cliente:</strong> {previewModal.data?.cliente || 'Cargando...'}</p>
              <p style={{margin: '0 0 0.5rem 0'}}><strong>Capacitación:</strong> {previewModal.programada.nombre}</p>
              <p style={{margin: '0 0 0.5rem 0'}}><strong>Mes:</strong> {getMesNombre(previewModal.programada.mes)}</p>
              <p style={{margin: 0}}><strong>Alcance:</strong> {previewModal.programada.alcance || 'TODOS'}</p>
            </div>
            {previewModal.loading ? (
              <div style={{textAlign: 'center', margin: '2rem 0', color: 'var(--text-light)'}}>Calculando impacto...</div>
            ) : previewModal.data && (
              <div style={{marginBottom: '1.5rem'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #e2e8f0'}}>
                  <span>Empleados elegibles:</span><span style={{fontWeight: 600}}>{previewModal.data.elegibles_totales}</span>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #e2e8f0'}}>
                  <span>Ya asignados:</span><span style={{fontWeight: 600, color: 'var(--text-light)'}}>{previewModal.data.ya_asignados}</span>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', fontWeight: 600, color: 'var(--primary-color)'}}>
                  <span>Nuevas asignaciones:</span><span>{previewModal.data.nuevas_asignaciones}</span>
                </div>
                {previewModal.data.elegibles_totales === 0 && (
                  <div style={{marginTop: '1rem', padding: '0.75rem', background: '#fee2e2', color: '#991b1b', borderRadius: '6px', fontSize: '0.9rem'}}>
                    <strong>Sin empleados elegibles.</strong> Verificá rubros, áreas o empleados activos.
                  </div>
                )}
              </div>
            )}
            <div style={{display: 'flex', gap: '1rem', justifyContent: 'flex-end'}}>
              <button className="btn btn-outline" onClick={() => setPreviewModal({show: false, programada: null, data: null, loading: false})} disabled={previewModal.loading}>Cancelar</button>
              <button className="btn btn-primary" onClick={confirmActivate} disabled={previewModal.loading || (previewModal.data && previewModal.data.elegibles_totales === 0)}>
                {previewModal.loading ? '...' : 'Confirmar Activación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editProgModal.show && editProgModal.p && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '450px'}}>
            <h3 style={{marginTop: 0}}>Configurar Instancia</h3>
            <p style={{marginBottom: '1.5rem', color: 'var(--text-light)', fontSize: '0.9rem'}}>Edita los datos reales de ejecución.</p>
            <label>Fecha Programada (Exacta)</label>
            <input type="date" style={{width: '100%', marginBottom: '1rem', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '4px'}}
              value={editProgModal.p.fecha_programada ? editProgModal.p.fecha_programada.substring(0, 10) : ""}
              onChange={e => setEditProgModal(prev => ({...prev, p: {...prev.p, fecha_programada: e.target.value}}))} />
            <label>Modalidad Real</label>
            <select style={{width: '100%', marginBottom: '1rem', padding: '0.5rem', border: '1px solid var(--border-color)', borderRadius: '4px'}}
              value={editProgModal.p.modalidad_final || "presencial"}
              onChange={e => setEditProgModal(prev => ({...prev, p: {...prev.p, modalidad_final: e.target.value}}))}>
              <option value="presencial">Presencial</option>
              <option value="virtual">Virtual</option>
              <option value="mixta">Mixta</option>
            </select>
            <label style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', cursor: 'pointer'}}>
              <input type="checkbox" checked={editProgModal.p.requiere_evaluacion_final}
                onChange={e => setEditProgModal(prev => ({...prev, p: {...prev.p, requiere_evaluacion_final: e.target.checked}}))} />
              Requiere Evaluación de Cierre
            </label>
            <div style={{display: 'flex', gap: '1rem', justifyContent: 'flex-end'}}>
              <button className="btn btn-outline" onClick={() => setEditProgModal({show: false, p: null})}>Cancelar</button>
              <button className="btn btn-primary" onClick={saveProgramadaInfo}>Guardar Cambios</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
