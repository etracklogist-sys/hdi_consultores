import React, { useState, useEffect } from 'react';
import { authFetch } from '../utils/apiClient';
import { useParams, Link, useNavigate } from 'react-router-dom';

import Loading from '../components/Loading';
import EmptyState from '../components/EmptyState';
import ConfirmModal from '../components/ConfirmModal';
import { adminService } from '../services/adminService';
import { materialService } from '../services/materialService';

export default function CapacitacionDetail() {
  const { id } = useParams();
  const [curso, setCurso] = useState(null);
  const [preguntas, setPreguntas] = useState([]);
  const [materiales, setMateriales] = useState([]);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [qText, setQText] = useState('');
  const [options, setOptions] = useState([{ id: 1, texto: '', es_correcta: true }, { id: 2, texto: '', es_correcta: false }]);

  // Material Modal states
  const [isMatModalOpen, setIsMatModalOpen] = useState(false);
  const [activeMaterial, setActiveMaterial] = useState(null);
  const [matForm, setMatForm] = useState({ titulo: '', descripcion: '', tipo: 'pdf', url: '', orden: 1, activo: true });
  
  // Delete confirm modal for materials
  const [matToDelete, setMatToDelete] = useState(null);

  // Capacitacion delete/archive modal
  const navigate = useNavigate();
  const [deleteModal, setDeleteModal] = useState({ show: false, mode: 'none' }); 
  const [isDeleting, setIsDeleting] = useState(false);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(null);

  const loadData = async () => {
    try {
      const [cData, pData, mData] = await Promise.all([
        adminService.getCapacitacion(id),
        adminService.getPreguntas(id),
        materialService.getMaterialesByCapacitacion(id)
      ]);
      setCurso(cData);
      setPreguntas(pData);
      setMateriales(mData);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setError("Error cargando los detalles de la capacitacion.");
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  // --- EDIT CAPACITACION LOGIC ---
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ 
    nombre: '', 
    descripcion: '', 
    duracion_horas: 1, 
    modalidad: 'presencial',
    rubro_id: '',
    area_id: ''
  });
  const [rubros, setRubros] = useState([]);
  const [areas, setAreas] = useState([]);

  const handleOpenEditModal = async () => {
    setEditForm({
      nombre: curso.nombre,
      descripcion: curso.descripcion || '',
      duracion_horas: curso.duracion_horas || 1,
      modalidad: curso.modalidad || 'presencial',
      rubro_id: curso.rubro_id || '',
      area_id: curso.area_id || ''
    });
    
    setIsEditModalOpen(true);
    
    // Lazy load rubros and areas if not loaded
    if (rubros.length === 0 || areas.length === 0) {
      try {
        const fetchJson = async (url) => {
          const res = await authFetch(url);
          return await res.json();
        };
        const [rData, aData] = await Promise.all([
           fetchJson(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/rubros`),
           fetchJson(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/areas`)
        ]);
        setRubros(rData);
        setAreas(aData);
      } catch (e) { console.error("Error loading options", e); }
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await adminService.updateCapacitacion(id, editForm);
      await loadData();
      setIsEditModalOpen(false);
    } catch (err) {
      console.error(err);
      setError("Error actualizando la capacitación");
    } finally {
      setLoading(false);
    }
  };

  const handleDestructiveAction = async () => {
    setIsDeleting(true);
    try {
      if (deleteModal.mode === 'delete') {
        const res = await authFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/capacitaciones/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(await res.text());
        navigate('/admin/capacitaciones');
      } else if (deleteModal.mode === 'archive') {
        const res = await authFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/capacitaciones/${id}/desactivar`, { method: 'PATCH' });
        if (!res.ok) throw new Error(await res.text());
        setDeleteModal({ show: false, mode: 'none' });
        await loadData();
      }
    } catch (err) {
      alert(`Error: ${err.message}`);
      setDeleteModal({ show: false, mode: 'none' });
    } finally {
      setIsDeleting(false);
    }
  };

  // --- CONFIGURATION LOGIC (Certification) ---
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configForm, setConfigForm] = useState({ requiere_evaluacion: true, puntaje_aprobacion: 7.5, meses_vigencia: 12 });

  const handleOpenConfigModal = () => {
    setConfigForm({
      requiere_evaluacion: curso.requiere_evaluacion,
      puntaje_aprobacion: curso.puntaje_aprobacion || 7.5,
      meses_vigencia: curso.meses_vigencia || 12
    });
    setIsConfigModalOpen(true);
  };

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    setLoading(true);
    await adminService.updateCapacitacionSettings(id, configForm);
    await loadData();
    setIsConfigModalOpen(false);
  };

  const [activeQuestion, setActiveQuestion] = useState(null);

  // --- PREGUNTAS LOGIC ---
  const handleOpenQuestionModal = (q = null) => {
    if (q) {
      setActiveQuestion(q.id);
      setQText(q.texto);
      setOptions(Array.isArray(q.opciones) ? q.opciones : JSON.parse(q.opciones_json || '[]'));
    } else {
      setActiveQuestion(null);
      setQText('');
      setOptions([{ id: 1, texto: '', es_correcta: true }, { id: 2, texto: '', es_correcta: false }]);
    }
    setIsModalOpen(true);
  };

  const handleAddOption = () => setOptions([...options, { id: Date.now(), texto: '', es_correcta: false }]);
  const handleOptionChange = (optId, field, value) => {
    setOptions(options.map(o => {
      if (field === 'es_correcta' && value === true) return o.id === optId ? { ...o, es_correcta: true } : { ...o, es_correcta: false };
      return o.id === optId ? { ...o, [field]: value } : o;
    }));
  };
  const handleRemoveOption = (optId) => {
    if (options.length > 2) {
      const newOptions = options.filter(o => o.id !== optId);
      if (!newOptions.some(o => o.es_correcta)) newOptions[0].es_correcta = true;
      setOptions(newOptions);
    }
  };
  const handleSaveQuestion = async (e) => {
    e.preventDefault();
    setLoading(true);
    const apiPayload = { texto: qText, opciones: options };
    
    if (activeQuestion) {
      await authFetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}/capacitaciones/preguntas/${activeQuestion}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(apiPayload)
      });
    } else {
      await adminService.createPregunta(id, apiPayload);
    }
    
    await loadData();
    setIsModalOpen(false);
  };
  const handleDeleteQuestion = async (preguntaId) => {
    if (!window.confirm("¿Confirmas eliminar esta pregunta del catálogo?")) return;
    setLoading(true);
    await adminService.deletePregunta(preguntaId);
    await loadData();
  };

  // --- MATERIALES LOGIC ---
  const handleOpenMatModal = (material = null) => {
    if (material) {
      setActiveMaterial(material.id);
      setMatForm({ ...material });
    } else {
      setActiveMaterial(null);
      setMatForm({ titulo: '', descripcion: '', tipo: 'pdf', url: '', orden: materiales.length + 1, activo: true });
    }
    setIsMatModalOpen(true);
  };

  const handleSaveMaterial = async (e) => {
    e.preventDefault();
    setLoading(true);
    if (activeMaterial) {
      await materialService.updateMaterial(activeMaterial, matForm);
    } else {
      await materialService.createMaterial(id, matForm);
    }
    await loadData();
    setIsMatModalOpen(false);
  };

  const confirmDeleteMaterial = async () => {
    if (!matToDelete) return;
    setLoading(true);
    await materialService.deleteMaterial(matToDelete.id);
    await loadData();
    setMatToDelete(null);
  };

  if (loading) return <Loading message="Cargando configuración del entrenamiento..." />;
  if (error) return <EmptyState title="Error de Conexión" description={error} />;
  if (!curso) return <EmptyState title="Curso no encontrado" description="La capacitación que buscas no existe o ha sido eliminada." />;

  const isFormValid = qText.trim() !== '' && options.length >= 2 && options.every(o => o.texto.trim() !== '') && options.some(o => o.es_correcta);

  return (
    <div className="detail-container" style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 1rem' }}>
      {/* HEADER SECTION */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div style={{ flex: 1 }}>
          <Link to="/admin/capacitaciones" style={{ color: '#64748B', textDecoration: 'none', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 600 }}>
            <span style={{ fontSize: '1.1rem' }}>←</span> Volver al catálogo
          </Link>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.4rem' }}>
            <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.025em', color: '#0F172A' }}>{curso.nombre}</h1>
            <span className="status-pill activo" style={{ padding: '0.25rem 0.5rem', letterSpacing: '0.04em', fontSize: '0.6rem' }}>
              {curso.requiere_evaluacion ? 'EXAMEN OBLIGATORIO' : 'ASISTENCIA REQUERIDA'}
            </span>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', color: '#64748B', fontSize: '0.75rem', fontWeight: 500 }}>
            <span>Vigencia: <b style={{ color: '#334155' }}>{curso.meses_vigencia || 12} meses</b></span>
            <span style={{ color: '#E2E8F0' }}>•</span>
            <span>Puntaje: <b style={{ color: '#334155' }}>{curso.puntaje_aprobacion || 7.5}/10</b></span>
            <span style={{ color: '#E2E8F0' }}>•</span>
            <span>Modalidad: <b style={{ color: '#334155' }}>{curso.modalidad === 'presencial' ? 'Presencial' : 'Virtual'}</b></span>
            <span style={{ color: '#E2E8F0' }}>•</span>
            <span>Duración: <b style={{ color: '#334155' }}>{curso.duracion_horas}h</b></span>
          </div>
        </div>
        
        <button className="btn btn-primary" onClick={() => handleOpenQuestionModal()} style={{ borderRadius: '6px', padding: '0.35rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.8rem' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Añadir Pregunta de Examen
        </button>
      </div>

      <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
        {/* LEFT COLUMN - MAIN CONTENT (~75%) */}
        <div style={{ flex: 1, minWidth: 0 }}>
          
          {/* SECONDARY ACTIONS BAR */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handleOpenEditModal} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Editar
              </button>
              {curso.can_delete && (
                <button 
                  onClick={() => setDeleteModal({ show: true, mode: 'delete' })} 
                  className="btn" 
                  style={{ display: 'flex', alignItems: 'center', padding: '0.45rem 0.85rem', fontSize: '0.8rem', background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' }}
                >
                  🗑️ Eliminar
                </button>
              )}
              {!curso.can_delete && curso.can_archive && curso.activa && (
                <button 
                  onClick={() => setDeleteModal({ show: true, mode: 'archive' })} 
                  className="btn" 
                  style={{ display: 'flex', alignItems: 'center', padding: '0.45rem 0.85rem', fontSize: '0.8rem', background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' }}
                >
                  📦 Desactivar
                </button>
              )}
              <div style={{width: '1px', background: 'var(--border-color)', margin: '0 0.25rem'}}></div>
              <button onClick={handleOpenConfigModal} className="btn btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.85rem', fontSize: '0.8rem' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                Configurar Certificación
              </button>
            </div>
            <button className="btn-text" onClick={() => handleOpenMatModal()} style={{ color: '#1E40AF', fontWeight: 700, fontSize: '0.8rem' }}>
               + AGREGAR MATERIAL
            </button>
          </div>

          {/* MATERIALES SECTION */}
          <div className="card" style={{ padding: '0', overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: 'none', background: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', borderBottom: '1px solid #F1F5F9' }}>
               <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 800, color: '#0F172A' }}>Materiales de Estudio</h3>
               <span style={{ fontSize: '0.65rem', color: '#64748B', fontWeight: 800, background: '#F1F5F9', padding: '0.2rem 0.5rem', borderRadius: '4px', letterSpacing: '0.5px' }}>
                 {materiales.length} ÍTEMS
               </span>
            </div>
            
            {materiales.length === 0 ? (
              <div style={{ padding: '2rem' }}>
                <EmptyState 
                   title="Sin material adjunto" 
                   description="Carga videos o documentos PDF." 
                   actionText="Subir mi primer material" 
                   onAction={() => handleOpenMatModal()} 
                />
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead className="table-header-gray">
                  <tr>
                    <th style={{ padding: '0.6rem 1rem', width: '60px', textAlign: 'center', fontSize: '0.65rem' }}>ORDEN</th>
                    <th style={{ padding: '0.6rem 1rem', width: '90px', fontSize: '0.65rem' }}>TIPO</th>
                    <th style={{ padding: '0.6rem 1rem', fontSize: '0.65rem' }}>CONTENIDO</th>
                    <th style={{ padding: '0.6rem 1rem', width: '100px', fontSize: '0.65rem' }}>ESTADO</th>
                    <th style={{ padding: '0.6rem 1rem', width: '150px', textAlign: 'right', fontSize: '0.65rem' }}>ACCIONES</th>
                  </tr>
                </thead>
                <tbody>
                  {materiales.map(m => (
                    <tr key={m.id} style={{ borderTop: '1px solid #F8FAFC' }}>
                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'center', color: '#94A3B8', fontWeight: 700, fontSize: '0.75rem' }}>
                        {String(m.orden).padStart(2, '0')}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#1E40AF', fontWeight: 800, fontSize: '0.6rem' }}>
                          {m.tipo === 'video' ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                          )}
                          {m.tipo.toUpperCase()}
                        </div>
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem' }}>
                        <div style={{ fontWeight: 700, color: '#1E293B', marginBottom: '0.1rem', fontSize: '0.8125rem' }}>{m.titulo}</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748B' }}>
                          {m.tipo === 'pdf' ? 'Doc • 12 slides' : 'Video • 08:30 min'}
                        </div>
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem' }}>
                        <span className={`status-pill ${m.activo ? 'activo' : 'borrador'}`} style={{ fontSize: '0.55rem', padding: '0.15rem 0.35rem' }}>
                          {m.activo ? 'ACTIVO' : 'BORRADOR'}
                        </span>
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', fontSize: '0.8rem', fontWeight: 600 }}>
                          <a href={m.url} target="_blank" rel="noreferrer" className="btn-text" style={{ color: '#2563EB' }}>Abrir</a>
                          <span style={{ color: '#E2E8F0' }}>·</span>
                          <button className="btn-text" onClick={() => handleOpenMatModal(m)} style={{ color: '#64748B' }}>Editar</button>
                          <span style={{ color: '#E2E8F0' }}>·</span>
                          <button className="btn-text danger" onClick={() => setMatToDelete(m)} style={{ color: '#EF4444' }}>Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN - SIDEBAR (~30%) */}
        <div style={{ width: '280px', flexShrink: 0 }}>
          <div style={{ position: 'sticky', top: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            <h3 style={{ margin: '0 0 -0.25rem 0', fontSize: '0.9rem', fontWeight: 800, color: '#0F172A' }}>Examen Final</h3>
            
            <div className="card" style={{ padding: '0.75rem', border: '1px solid var(--border-color)', boxShadow: 'none', background: 'white' }}>
              <div style={{ marginBottom: '1rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.7rem', fontWeight: 800, color: '#64748B' }}>BANCO DE PREGUNTAS ({preguntas.length})</h4>
              </div>

              {preguntas.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
                  <p style={{ fontSize: '0.75rem', color: '#94A3B8' }}>No hay preguntas configuradas.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {preguntas.map((p, index) => {
                    const ops = Array.isArray(p.opciones) ? p.opciones : JSON.parse(p.opciones_json || '[]');
                    return (
                      <div key={p.id}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                          <h5 style={{ margin: 0, fontSize: '0.8rem', fontWeight: 800, color: '#1E293B', lineHeight: 1.35, flex: 1 }}>
                            Q{index + 1}: {p.texto}
                          </h5>
                          <div style={{ display: 'flex', gap: '0.4rem', fontSize: '0.7rem', fontWeight: 700, marginLeft: '0.5rem' }}>
                            <button className="btn-text" onClick={() => handleOpenQuestionModal(p)}>Editar</button>
                            <span style={{ color: '#E2E8F0' }}>·</span>
                            <button className="btn-text danger" onClick={() => handleDeleteQuestion(p.id)}>Eliminar</button>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {ops.map(o => (
                            <div key={o.id} className={`answer-option ${o.es_correcta ? 'correct' : 'incorrect'}`} style={{ margin: 0, padding: '0.5rem 0.6rem' }}>
                              <div style={{ 
                                width: '14px', height: '14px', flexShrink: 0, borderRadius: '50%', 
                                border: `1.5px solid ${o.es_correcta ? '#10B981' : '#CBD5E1'}`, 
                                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                background: o.es_correcta ? '#10B981' : 'white' 
                              }}>
                                {o.es_correcta && <svg width="8" height="8" viewBox="0 0 24 24" stroke="white" strokeWidth="4" fill="none"><polyline points="20 6 9 17 4 12"/></svg>}
                              </div>
                              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{o.texto}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

             <div className="performance-card" style={{ padding: '0.85rem' }}>
                <h4 style={{ margin: '0 0 0.3rem 0', fontSize: '0.6rem', fontWeight: 900, letterSpacing: '0.1em', opacity: 0.8 }}>RENDIMIENTO PROMEDIO</h4>
                <div className="performance-value" style={{ margin: '0 0 0.5rem 0', fontSize: '1.75rem', fontWeight: 900 }}>8.2<small style={{ fontSize: '0.75rem', opacity: 0.7 }}> / 10</small></div>
               <div className="progress-bar-outer" style={{ height: '6px' }}>
                 <div className="progress-bar-inner" style={{ width: '82%' }}></div>
               </div>
               <p style={{ marginTop: '0.75rem', marginBottom: 0, fontSize: '0.7rem', fontWeight: 500, fontStyle: 'italic', opacity: 0.9 }}>
                 "Buen desempeño general en los módulos de ciberseguridad."
               </p>
            </div>
          </div>
        </div>
      </div>

      {/* EDIT MODAL */}
      {isEditModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '500px'}}>
            <h3 style={{marginTop: 0}}>Editar Capacitación</h3>
            <form onSubmit={handleSaveEdit}>
              <label>Nombre del Entrenamiento</label>
              <input type="text" required value={editForm.nombre} onChange={e => setEditForm({...editForm, nombre: e.target.value})} />

              <label>Descripción</label>
              <textarea rows="3" value={editForm.descripcion} onChange={e => setEditForm({...editForm, descripcion: e.target.value})} placeholder="Breve resumen del contenido..." />

              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem'}}>
                <div>
                  <label>Duración (Horas)</label>
                  <input type="number" min="1" value={editForm.duracion_horas} onChange={e => setEditForm({...editForm, duracion_horas: parseInt(e.target.value)})} />
                </div>
                <div>
                  <label>Modalidad</label>
                  <select value={editForm.modalidad} onChange={e => setEditForm({...editForm, modalidad: e.target.value})}>
                    <option value="presencial">Presencial</option>
                    <option value="virtual">Virtual / e-Learning</option>
                  </select>
                </div>
              </div>

              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem'}}>
                <div>
                  <label>Rubro Vinculado</label>
                  <select value={editForm.rubro_id} onChange={e => setEditForm({...editForm, rubro_id: e.target.value ? parseInt(e.target.value) : ''})}>
                    <option value="">Cualquiera</option>
                    {rubros.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label>Área Específica</label>
                  <select value={editForm.area_id} onChange={e => setEditForm({...editForm, area_id: e.target.value ? parseInt(e.target.value) : ''})}>
                    <option value="">Todas las áreas</option>
                    {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                  </select>
                </div>
              </div>

              <div style={{display: 'flex', gap: '0.75rem', marginTop: '1.25rem'}}>
                <button type="button" className="btn btn-outline" onClick={() => setIsEditModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Guardar Cambios</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIG MODAL */}
      {isConfigModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '400px'}}>
            <h3 style={{marginTop: 0}}>Configurar Certificación</h3>
            <form onSubmit={handleSaveConfig}>
              <label style={{display: 'block', marginBottom: '0.5rem', fontWeight: 500}}>Vigencia del Certificado (Meses)</label>
              <input type="number" required min="1" max="120" value={configForm.meses_vigencia} onChange={e => setConfigForm({...configForm, meses_vigencia: parseInt(e.target.value)})} style={{width: '100%', marginBottom: '1rem'}} />

              <label style={{display: 'block', marginBottom: '0.5rem', fontWeight: 500}}>Tipo de Certificación</label>
              <select value={configForm.requiere_evaluacion} onChange={e => setConfigForm({...configForm, requiere_evaluacion: e.target.value === 'true'})} style={{width: '100%', marginBottom: '1rem'}}>
                <option value="false">Solo asistencia</option>
                <option value="true">Requiere evaluación</option>
              </select>

              {!configForm.requiere_evaluacion && (
                <div style={{padding: '0.75rem', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', color: '#1e3a8a', fontSize: '0.9rem', marginBottom: '1rem'}}>
                  ℹ️ La certificación se emitirá automáticamente a los empleados que cumplan con la asistencia registrada.
                </div>
              )}

              {configForm.requiere_evaluacion && (
                <>
                  <div style={{padding: '0.75rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', color: '#92400e', fontSize: '0.9rem', marginBottom: '1rem'}}>
                    ⚠️ La certificación dependerá de que el empleado apruebe el marco de evaluación configurado.
                  </div>
                  <label style={{display: 'block', marginBottom: '0.5rem', fontWeight: 500}}>Puntaje Mínimo para Aprobar (Escala de 1 a 10)</label>
                  <input type="number" step="0.5" min="1" max="10" required value={configForm.puntaje_aprobacion} onChange={e => setConfigForm({...configForm, puntaje_aprobacion: parseFloat(e.target.value)})} style={{width: '100%', marginBottom: '1rem'}} />
                </>
              )}

              <div style={{display: 'flex', gap: '0.75rem', marginTop: '1.25rem'}}>
                <button type="button" className="btn btn-outline" onClick={() => setIsConfigModalOpen(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary">Actualizar Certificación</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MATERIAL MODAL */}
      {isMatModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '500px'}}>
            <h3 style={{marginTop: 0}}>{activeMaterial ? 'Editar Material' : 'Agregar Material'}</h3>
            <form onSubmit={handleSaveMaterial}>
               <label>Título del Material</label>
               <input type="text" required value={matForm.titulo} onChange={e => setMatForm({...matForm, titulo: e.target.value})} placeholder="Ej. Guía de Seguridad" />
               
               <label>Descripción Corta</label>
               <textarea required rows="2" value={matForm.descripcion} onChange={e => setMatForm({...matForm, descripcion: e.target.value})} placeholder="Descripción visible para el empleado"></textarea>
               
               <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
                  <div>
                    <label>Tipo de Material</label>
                    <select value={matForm.tipo} onChange={e => setMatForm({...matForm, tipo: e.target.value})}>
                      <option value="pdf">Documento PDF</option>
                      <option value="video">Enlace de Video</option>
                      <option value="link">Enlace Web</option>
                      <option value="imagen">Imagen / Infografía</option>
                    </select>
                  </div>
                  <div>
                    <label>Orden de Visualización</label>
                    <input type="number" min="1" required value={matForm.orden} onChange={e => setMatForm({...matForm, orden: parseInt(e.target.value)})} />
                  </div>
               </div>

               <label>URL (Enlace al archivo o recurso web)</label>
               <input type="url" required value={matForm.url} onChange={e => setMatForm({...matForm, url: e.target.value})} placeholder="https://..." />

               <label style={{display: 'flex', alignItems: 'center', cursor: 'pointer', marginTop: '1rem'}}>
                 <input type="checkbox" checked={matForm.activo} onChange={e => setMatForm({...matForm, activo: e.target.checked})} style={{width: 'auto', margin: '0 0.5rem 0 0'}} />
                 Publicar e-Learning (Activo)
               </label>

               <div style={{display: 'flex', gap: '0.75rem', marginTop: '1.25rem'}}>
                 <button type="button" className="btn btn-outline" onClick={() => setIsMatModalOpen(false)}>Cancelar</button>
                 <button type="submit" className="btn btn-primary">Guardar Material</button>
               </div>
            </form>
          </div>
        </div>
      )}

      {/* PREGUNTA MODAL */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '600px'}}>
            <h3 style={{marginTop: 0}}>Configurar Pregunta</h3>
            <form onSubmit={handleSaveQuestion}>
              <label style={{display: 'block', marginBottom: '0.5rem', fontWeight: 500}}>Texto de la Pregunta</label>
              <textarea required style={{width: '100%', padding: '0.8rem', marginBottom: '1rem', border: '1px solid var(--border-color)', borderRadius: '6px'}} value={qText} onChange={e => setQText(e.target.value)} placeholder="Escribe la pregunta aquí..." />
              
              <div style={{marginBottom: '1rem'}}>
                <label style={{display: 'block', marginBottom: '0.5rem', fontWeight: 500}}>Opciones de Respuesta</label>
                {options.map((opt, i) => (
                  <div key={opt.id} style={{display: 'flex', alignItems: 'center', gap: '12px', width: '100%', marginBottom: '12px'}}>
                    <input type="radio" name="opt_correct" checked={opt.es_correcta} onChange={() => handleOptionChange(opt.id, 'es_correcta', true)} title="Marcar como correcta" style={{cursor: 'pointer', margin: 0, width: '18px'}} />
                    <input type="text" required value={opt.texto} onChange={e => handleOptionChange(opt.id, 'texto', e.target.value)} placeholder={`Ejemplo de opción ${i+1}`} style={{flex: 1, margin: 0}} />
                    {options.length > 2 ? (
                      <button type="button" onClick={() => handleRemoveOption(opt.id)} style={{background: 'transparent', border: 'none', color: 'var(--accent-red)', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.2rem'}}>×</button>
                    ) : (
                      <div style={{width: '18px'}}></div>
                    )}
                  </div>
                ))}
                {options.filter(o => o.texto.trim() === '').length > 0 && <p style={{fontSize: '0.85rem', color: 'var(--accent-amber)', margin: '0.5rem 0'}}>* Opciones no pueden estar vacías.</p>}
                {!options.some(o => o.es_correcta) && <p style={{fontSize: '0.85rem', color: 'var(--accent-red)', margin: '0.5rem 0'}}>* Marca al menos una correcta.</p>}

                <button type="button" className="btn" style={{background: '#f1f5f9', marginTop: '0.5rem'}} onClick={handleAddOption}>+ Añadir Otra Opción</button>
              </div>

               <div style={{display: 'flex', gap: '0.75rem', marginTop: '1.25rem'}}>
                 <button type="button" className="btn btn-outline" onClick={() => setIsModalOpen(false)}>Cancelar</button>
                 <button type="submit" className="btn btn-primary" disabled={!isFormValid}>Guardar Pregunta</button>
               </div>
            </form>
          </div>
        </div>
      )}

      {matToDelete && (
        <ConfirmModal 
          title="Eliminar Material"
          message={`¿Estás seguro que deseas eliminar "${matToDelete.titulo}"?`}
          onConfirm={confirmDeleteMaterial}
          onCancel={() => setMatToDelete(null)}
          isDanger={true}
        />
      )}

      {/* Delete/Archive Confirmation Modal */}
      {deleteModal.show && (
        <div className="modal-overlay">
          <div className="modal-content" style={{maxWidth: '450px'}}>
            <h3 style={{marginTop: 0, color: deleteModal.mode === 'delete' ? '#dc2626' : '#d97706'}}>
              {deleteModal.mode === 'delete' ? 'Eliminar Capacitación' : 'Desactivar Capacitación'}
            </h3>
            <p>
              {deleteModal.mode === 'delete' 
                ? `¿Estás seguro de que deseas eliminar permanentemente "${curso.nombre}"? Esta acción no se puede deshacer, ya que la capacitación no posee asignaciones, material ni evaluaciones en ejecución.`
                : `"${curso.nombre}" posee elementos (material o vinculaciones a otras entidades). No puede ser eliminada permanentemente para preservar la integridad de los datos. Será desactivada y no podrá programarse nuevamente.`}
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
