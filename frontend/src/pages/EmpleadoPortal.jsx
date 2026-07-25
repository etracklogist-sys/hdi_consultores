import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { employeeService } from '../services/employeeService';
import { materialService } from '../services/materialService';

// Modern Components
import DashboardLayout from '../components/employee/DashboardLayout';
import KpiCard from '../components/employee/KpiCard';
import PendingActionsCard from '../components/employee/PendingActionsCard';
import ComplianceStatusCard from '../components/employee/ComplianceStatusCard';
import AlertBanner from '../components/employee/AlertBanner';
import SignaturePad from '../components/employee/SignaturePad';

import Loading from '../components/Loading';
import ErrorState from '../components/ErrorState';
import EmptyState from '../components/EmptyState';

const STATUS_CONFIG = {
  ASSIGNED: { label: 'Pendiente', color: '#f59e0b', bg: '#fef3c7' },
  IN_PROGRESS: { label: 'En progreso', color: '#3b82f6', bg: '#dbeafe' },
  PENDING_EVALUATION: { label: 'Evaluación pend.', color: '#8b5cf6', bg: '#ede9fe' },
  APPROVED: { label: 'Aprobado', color: '#10b981', bg: '#d1fae5' },
  COMPLETED: { label: 'Completado', color: '#059669', bg: '#d1fae5' },
  CERTIFIED: { label: 'Certificado', color: '#0891b2', bg: '#cffafe' },
  VENCIDO: { label: 'Vencido', color: '#ef4444', bg: '#fee2e2' },
};

export default function EmpleadoPortal() {
  const navigate = useNavigate();
  const [view, setView] = useState('dashboard'); // 'dashboard', 'trainings', 'certificados', 'materials', 'evaluation', 'result', 'review', 'firma'
  
  // Data States
  const [trainings, setTrainings] = useState([]);
  const [progreso, setProgreso] = useState({ total_asignadas: 0, total_completadas: 0, porcentaje_cumplimiento: 0 });
  const [certificados, setCertificados] = useState([]);
  
  // Interaction States
  const [activeCourse, setActiveCourse] = useState(null);
  const [courseMaterials, setCourseMaterials] = useState([]);
  const [materialOpened, setMaterialOpened] = useState(false);
  const [activeIntento, setActiveIntento] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [evalProgress, setEvalProgress] = useState(null);
  const [finalResult, setFinalResult] = useState(null);
  const [reviewStars, setReviewStars] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  
  // Signature state
  const [firma, setFirma] = useState(null);
  const [firmaSaving, setFirmaSaving] = useState(false);
  
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (!currentUser) {
      navigate('/');
      return;
    }
    loadPortalData();
  }, [navigate]);

  const loadPortalData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tData, pData, cData, fData] = await Promise.all([
        employeeService.getMisCapacitaciones(),
        employeeService.getMiProgreso(),
        employeeService.getMisCertificados(),
        employeeService.getFirma().catch(() => ({ firma_base64: null }))
      ]);
      setTrainings(tData);
      setProgreso(pData);
      setCertificados(cData);
      setFirma(fData?.firma_base64 || null);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleError = (err) => {
    const msg = err.message || 'Error inesperado';
    if (msg.includes('401') || msg.includes('Sesión expirada')) {
      setError('Sesión expirada. Redirigiendo...');
      setTimeout(() => {
        authService.logout();
        navigate('/');
      }, 2000);
    } else {
      setError(msg);
    }
  };

  // --- ACTIONS ---

  const handleComenzar = async (training) => {
    setActionLoading(true);
    setActiveCourse(training);
    try {
      // Always show materials first when starting a course
      const mats = await materialService.getMaterialesByCapacitacion(training.capacitacion_id || training.id); 
      setCourseMaterials(mats.filter(m => m.activo));
      setMaterialOpened(false);
      
      setView('materials');
    } catch (err) {
      handleError(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleContinuar = async (training) => {
    setActionLoading(true);
    setActiveCourse(training);
    setActiveIntento(training.intento_id);
    try {
      // Always show materials first so employee can review before continuing evaluation
      const mats = await materialService.getMaterialesByCapacitacion(training.capacitacion_id || training.id);
      setCourseMaterials(mats.filter(m => m.activo));
      setMaterialOpened(training.material_viewed || false);
      setView('materials');
    } catch (err) {
      handleError(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenResource = (url) => {
    window.open(url, '_blank', 'noopener,noreferrer');
    if (!materialOpened && activeCourse) {
      setMaterialOpened(true);
      employeeService.markMaterialViewed(activeCourse.id).catch(() => {});
    }
  };

  const handleResumeEvaluation = async () => {
    setActionLoading(true);
    try {
      const qData = await employeeService.getPreguntasEvaluacion(activeIntento);
      setQuestions(qData);
      setCurrentQIndex(0);
      setSelectedOption(null);
      setEvalProgress({
        total_preguntas: qData.length,
        respondidas: qData.filter(q => q.respondida).length,
        porcentaje_avance: qData.length > 0 ? (qData.filter(q => q.respondida).length / qData.length) * 100 : 0
      });
      setView('evaluation');
    } catch (err) {
      handleError(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartEvaluation = async (training = null) => {
    setActionLoading(true);
    const course = training || activeCourse;
    if (training) setActiveCourse(training);
    try {
      const data = await employeeService.iniciarEvaluacion(course.id);
      const attemptId = data.intento_id || data.id;
      setActiveIntento(attemptId);
      
      const qData = await employeeService.getPreguntasEvaluacion(attemptId);
      setQuestions(qData);
      setCurrentQIndex(0);
      setSelectedOption(null);
      setEvalProgress({
        total_preguntas: qData.length,
        respondidas: 0,
        porcentaje_avance: 0
      });
      setView('evaluation');
    } catch (err) {
      handleError(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAnswerQuestion = async () => {
    if (!selectedOption) return;
    setActionLoading(true);
    try {
      const currentQ = questions[currentQIndex];
      const data = await employeeService.responderPregunta({
        intento_id: activeIntento,
        pregunta_id: currentQ.id,
        opcion_elegida_id: selectedOption
      });
      
      setEvalProgress(data.progreso);
      
      if (currentQIndex < questions.length - 1) {
        setCurrentQIndex(currentQIndex + 1);
        setSelectedOption(null);
      }
    } catch (err) {
      handleError(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinalize = async () => {
    if (!selectedOption) return;
    setActionLoading(true);
    try {
      const currentQ = questions[currentQIndex];
      await employeeService.responderPregunta({
        intento_id: activeIntento,
        pregunta_id: currentQ.id,
        opcion_elegida_id: selectedOption
      });
      const data = await employeeService.finalizarEvaluacion({ intento_id: activeIntento });
      setFinalResult(data);
      setView('result');
    } catch (err) {
      handleError(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkCompleted = async (training) => {
    setActionLoading(true);
    try {
      await employeeService.markCompleted(training.id);
      await loadPortalData();
      setView('dashboard');
    } catch (err) {
      handleError(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDownloadCertificado = async (cert) => {
    setActionLoading(true);
    try {
      await employeeService.downloadCertificado(cert.hash);
    } catch (err) {
      handleError(err);
    } finally {
      setActionLoading(true);
      setTimeout(() => setActionLoading(false), 500);
    }
  };

  const handleDownloadFromTraining = async (training) => {
    if (training.certificado_hash) {
      setActionLoading(true);
      try {
        await employeeService.downloadCertificado(training.certificado_hash);
      } catch (err) {
        handleError(err);
      } finally {
        setTimeout(() => setActionLoading(false), 500);
      }
    }
  };

  const handleSaveFirma = async (base64Data) => {
    setFirmaSaving(true);
    try {
      await employeeService.uploadFirma(base64Data);
      setFirma(base64Data);
    } catch (err) {
      handleError(err);
    } finally {
      setFirmaSaving(false);
    }
  };

  // --- RENDERS ---

  const renderProfile = () => {
    const user = authService.getCurrentUser()?.empleado || {};
    
    return (
      <div style={{ animation: 'fadeIn 0.3s ease-out', maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
          <div>
            <h1>Mi Perfil</h1>
            <p style={{ color: 'var(--text-light)', margin: 0 }}>Información personal y de la empresa.</p>
          </div>
        </div>

        <div className="card-saas" style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>Datos Personales</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>Nombre Completo</label>
              <div style={{ fontSize: '1.1rem', fontWeight: 500, marginTop: '0.25rem' }}>{user.nombre_completo || 'No especificado'}</div>
            </div>
            
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>DNI</label>
              <div style={{ fontSize: '1.1rem', fontWeight: 500, marginTop: '0.25rem' }}>{user.dni || 'No especificado'}</div>
            </div>
            
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>Correo Electrónico</label>
              <div style={{ fontSize: '1.1rem', fontWeight: 500, marginTop: '0.25rem' }}>{user.email || 'No especificado'}</div>
            </div>
            
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase' }}>Empresa</label>
              <div style={{ fontSize: '1.1rem', fontWeight: 500, marginTop: '0.25rem', color: 'var(--primary-color)' }}>{user.empresa || 'No especificada'}</div>
            </div>
          </div>
        </div>
        
        <div className="card-saas">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <div>
              <h3 style={{ margin: 0 }}>Firma Digital</h3>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-light)' }}>Gestiona tu firma para los certificados.</p>
            </div>
            <button className="btn btn-primary" onClick={() => setView('firma')}>
              {firma ? 'Actualizar Firma' : 'Crear Firma'}
            </button>
          </div>
          
          {firma ? (
            <div style={{ background: '#F8FAFC', padding: '1.5rem', borderRadius: '12px', display: 'flex', justifyContent: 'center' }}>
              <img src={firma} alt="Mi Firma" style={{ maxHeight: '100px', objectFit: 'contain' }} />
            </div>
          ) : (
            <div style={{ background: '#FFFBEB', color: '#92400E', padding: '1rem', borderRadius: '8px', textAlign: 'center', fontSize: '0.9rem' }}>
              ⚠️ Aún no has registrado tu firma digital. Deberás hacerlo antes de poder obtener certificados.
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderDashboard = () => {
    const pendingCount = trainings.filter(t => ['ASSIGNED', 'IN_PROGRESS', 'PENDING_EVALUATION'].includes(t.estado_ui)).length;
    const certifiedCount = trainings.filter(t => t.estado_ui === 'CERTIFIED').length;
    
    return (
      <div style={{ animation: 'fadeIn 0.5s ease-out' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ marginBottom: '0.25rem' }}>Dashboard General</h1>
            <p style={{ margin: 0, color: 'var(--text-light)', fontSize: '0.9rem' }}>
              Monitorea tu progreso y capacitaciones obligatorias.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn" style={{ background: 'white', border: '1px solid var(--border-color)', borderRadius: '8px' }} onClick={() => setView('firma')}>
              ✍️ Mi Firma
            </button>
            <button className="btn btn-primary" style={{ borderRadius: '8px', padding: '0.6rem 1.25rem' }} onClick={() => setView('trainings')}>
              Ver mis capacitaciones
            </button>
          </div>
        </div>

        <AlertBanner count={pendingCount} onAction={() => setView('trainings')} />

        <div className="kpi-grid-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem', marginBottom: '2.5rem' }}>
          <KpiCard 
            label="Pendientes" 
            value={pendingCount} 
            icon="⌛" 
            iconBg="#FEF3C7" 
            iconColor="#92400E" 
          />
          <KpiCard 
            label="Completadas" 
            value={progreso.total_completadas} 
            icon="✅" 
            iconBg="#D1FAE5" 
            iconColor="#065F46" 
          />
          <KpiCard 
            label="Certificados" 
            value={certifiedCount} 
            icon="🏆" 
            iconBg="#DBEAFE" 
            iconColor="#1E40AF" 
          />
        </div>

        <div className="actions-grid-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: '2rem' }}>
          <section>
            <PendingActionsCard 
              actions={trainings} 
              onComenzar={handleComenzar} 
              onContinuar={handleContinuar}
              onMarkCompleted={handleMarkCompleted}
              onDownloadCert={handleDownloadFromTraining}
            />
          </section>
          
          <aside>
            <ComplianceStatusCard 
              percentage={progreso.porcentaje_cumplimiento} 
              total={progreso.total_asignadas} 
              completed={progreso.total_completadas}
            />
          </aside>
        </div>
      </div>
    );
  };

  const renderTrainings = () => (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ marginBottom: '0.25rem' }}>Mis Capacitaciones</h1>
          <p style={{ margin: 0, color: 'var(--text-light)', fontSize: '0.9rem' }}>Listado completo de módulos asignados.</p>
        </div>
        <button className="btn" style={{ background: 'white', border: '1px solid var(--border-color)' }} onClick={() => setView('dashboard')}>
          ← Volver
        </button>
      </div>

      <div className="card-saas" style={{ padding: 0, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-light)' }}>Nombre del Módulo</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-light)' }}>Modalidad</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-light)' }}>Estado</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-light)' }}>Progreso</th>
              <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-light)' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {trainings.map(t => {
              const sc = STATUS_CONFIG[t.estado_ui] || STATUS_CONFIG.ASSIGNED;
              return (
                <tr key={t.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '1.25rem 1.5rem', fontWeight: 600 }}>{t.nombre}</td>
                  <td style={{ padding: '1.25rem 1.5rem', fontSize: '0.85rem' }}>
                    {t.modalidad === 'virtual' ? '💻 Virtual' : '🏢 Presencial'}
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <span style={{
                      fontSize: '0.75rem', fontWeight: 700,
                      padding: '0.2rem 0.6rem', borderRadius: '6px',
                      background: sc.bg, color: sc.color,
                    }}>
                      {sc.label}
                    </span>
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.4rem', fontSize: '0.75rem' }}>
                      <span title="Material">{t.material_viewed ? '✅' : '⬜'}</span>
                      {t.requiere_evaluacion && (
                        <span title="Evaluación">{['APPROVED', 'COMPLETED', 'CERTIFIED'].includes(t.estado_ui) ? '✅' : '⬜'}</span>
                      )}
                      <span title="Completado">{['COMPLETED', 'CERTIFIED'].includes(t.estado_ui) ? '✅' : '⬜'}</span>
                    </div>
                  </td>
                  <td style={{ padding: '1.25rem 1.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      {t.estado_ui === 'CERTIFIED' ? (
                        <button className="btn btn-text" style={{ color: 'var(--primary-color)' }} onClick={() => handleDownloadFromTraining(t)}>
                          Descargar Certificado
                        </button>
                      ) : t.puede_continuar ? (
                        <button className="btn btn-primary" style={{ fontSize: '0.8rem' }} onClick={() => handleContinuar(t)}>Continuar</button>
                      ) : t.puede_marcar_completada ? (
                        <button className="btn" style={{ background: '#059669', color: 'white', border: 'none', fontSize: '0.8rem' }} onClick={() => handleMarkCompleted(t)}>
                          Completar ✓
                        </button>
                      ) : t.puede_comenzar ? (
                        <button className="btn btn-primary" style={{ fontSize: '0.8rem' }} onClick={() => handleComenzar(t)}>
                          {t.requiere_evaluacion && t.estado_ui === 'PENDING_EVALUATION' ? 'Evaluar' : 'Comenzar'}
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderMaterials = () => (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <button className="btn btn-text" onClick={() => setView('trainings')} style={{ paddingLeft: 0 }}>← Volver a Capacitaciones</button>
          <h1 style={{ marginTop: '0.5rem' }}>{activeCourse?.nombre}</h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-light)' }}>
            {activeCourse?.modalidad === 'virtual' ? '💻 Virtual' : '🏢 Presencial'} • {activeCourse?.duracion_estimada || '—'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {activeCourse?.requiere_evaluacion && (materialOpened || activeCourse?.material_viewed) && (
            <button className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', fontSize: '0.9rem' }} onClick={() => activeIntento ? handleResumeEvaluation() : handleStartEvaluation()}>
              Comenzar Evaluación →
            </button>
          )}
          {activeCourse?.puede_marcar_completada && (
            <button className="btn" style={{ padding: '0.75rem 1.5rem', fontSize: '0.9rem', background: '#059669', color: 'white', border: 'none' }} onClick={() => handleMarkCompleted(activeCourse)}>
              Marcar como Completada ✓
            </button>
          )}
        </div>
      </div>

      {/* Material viewed indicator */}
      <div style={{
        background: (materialOpened || activeCourse?.material_viewed) ? '#f0fdf4' : '#fffbeb',
        border: (materialOpened || activeCourse?.material_viewed) ? '1px solid #bbf7d0' : '1px solid #fde68a',
        borderRadius: '12px',
        padding: '0.75rem 1.25rem',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '0.85rem',
        color: (materialOpened || activeCourse?.material_viewed) ? '#166534' : '#92400e',
      }}>
        {(materialOpened || activeCourse?.material_viewed) ? '✅ Material registrado como visto' : '⚠️ Debes abrir el material antes de continuar'}
        <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: 'auto' }}>
          {activeCourse?.requiere_evaluacion 
            ? 'Ahora puedes realizar la evaluación' 
            : (activeCourse?.modalidad === 'presencial' 
              ? 'El administrador registrará tu asistencia' 
              : 'Puedes marcar como completada')}
        </span>
      </div>

      <div className="card-saas">
        <h3 style={{ marginBottom: '1.5rem' }}>Materiales de estudio</h3>
        {courseMaterials.length === 0 ? (
          <EmptyState title="No hay materiales" description="Este módulo no requiere lectura previa." />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
            {courseMaterials.map(mat => (
              <div key={mat.id} className="card-saas" style={{ padding: '1.25rem', border: '1px solid #F1F5F9' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>{mat.tipo === 'pdf' ? '📄' : '▶️'}</div>
                <h4 style={{ margin: '0 0 0.5rem' }}>{mat.titulo}</h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-light)', minHeight: '3em' }}>{mat.descripcion}</p>
                <button className="btn" style={{ width: '100%', marginTop: '1rem', background: '#F8FAFC', cursor: 'pointer' }} onClick={() => handleOpenResource(mat.url)}>
                  Abrir Recurso
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderEvaluation = () => {
    if (!questions.length) return <Loading message="Preparando examen..." />;
    const q = questions[currentQIndex];
    
    return (
      <div style={{ maxWidth: '700px', margin: '0 auto', animation: 'fadeIn 0.4s ease-out' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary-color)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Evaluación de Conocimiento
          </span>
          <h2 style={{ fontSize: '1.75rem', marginTop: '0.5rem' }}>{activeCourse?.nombre}</h2>
        </div>

        <div className="card-saas" style={{ padding: '2.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '0.75rem', fontWeight: 600 }}>
             <span style={{ color: 'var(--text-light)' }}>PREGUNTA {currentQIndex + 1} DE {questions.length}</span>
             <span style={{ color: 'var(--primary-color)' }}>{Math.round(evalProgress?.porcentaje_avance || 0)}% COMPLETADO</span>
          </div>
          <div style={{ height: '6px', background: '#F1F5F9', borderRadius: '3px', marginBottom: '2.5rem', overflow: 'hidden' }}>
            <div style={{ width: `${evalProgress?.porcentaje_avance || 0}%`, height: '100%', background: 'var(--primary-color)', transition: 'width 0.3s ease' }} />
          </div>

          <h3 style={{ fontSize: '1.15rem', lineHeight: '1.6', marginBottom: '2rem' }}>{q.texto}</h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {q.opciones.map(opt => (
              <label 
                key={opt.id} 
                style={{ 
                  display: 'flex', alignItems: 'center', padding: '1.25rem', border: '1px solid', 
                  borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s',
                  background: selectedOption === opt.id ? '#EFF6FF' : 'white',
                  borderColor: selectedOption === opt.id ? 'var(--primary-color)' : '#E2E8F0',
                }}
              >
                <input 
                  type="radio" 
                  name="quiz" 
                  checked={selectedOption === opt.id} 
                  onChange={() => setSelectedOption(opt.id)}
                  style={{ marginRight: '1rem', width: '1.2rem', height: '1.2rem' }}
                />
                <span style={{ fontWeight: 500 }}>{opt.texto}</span>
              </label>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3rem', paddingTop: '1.5rem', borderTop: '1px solid #F1F5F9' }}>
            <button className="btn" disabled={currentQIndex === 0} onClick={() => setCurrentQIndex(i => i - 1)}>Anterior</button>
            {currentQIndex === questions.length - 1 ? (
              <button className="btn btn-primary" style={{ padding: '0.75rem 2rem' }} disabled={!selectedOption || actionLoading} onClick={handleFinalize}>
                Finalizar Evaluación
              </button>
            ) : (
              <button className="btn btn-primary" style={{ padding: '0.75rem 2rem' }} disabled={!selectedOption || actionLoading} onClick={handleAnswerQuestion}>
                Siguiente Pregunta
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderResult = () => (
    <div style={{ maxWidth: '500px', margin: '0 auto', textAlign: 'center', animation: 'scaleUp 0.5s ease-out' }}>
       <div className="card-saas" style={{ padding: '3rem 2rem' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>{finalResult?.aprobado ? '🎉' : '⚠️'}</div>
          <h2 style={{ fontSize: '1.75rem' }}>{finalResult?.aprobado ? '¡Felicitaciones!' : 'Hay que seguir repasando'}</h2>
          <p style={{ color: 'var(--text-light)', marginBottom: '2rem' }}>
            {finalResult?.aprobado 
              ? 'Has aprobado satisfactoriamente esta capacitación obligatoria.' 
              : 'No alcanzaste el puntaje mínimo de aprobación (70%). Puedes volver a intentarlo.'}
          </p>
          
          <div style={{ background: '#F8FAFC', borderRadius: '16px', padding: '1.5rem', marginBottom: '2.5rem' }}>
             <div style={{ color: 'var(--text-light)', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', marginBottom: '0.5rem' }}>Nota Final</div>
             <div style={{ fontSize: '3rem', fontWeight: 900, color: finalResult?.aprobado ? 'var(--accent-green)' : 'var(--accent-red)' }}>
               {finalResult?.nota?.toFixed(1) || '0.0'}/10
             </div>
          </div>

          {finalResult?.aprobado && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '1rem', marginBottom: '1.5rem', fontSize: '0.85rem', color: '#166534' }}>
              🏆 Tu certificado ha sido generado automáticamente{firma ? ' con tu firma digital' : ''}. Puedes descargarlo desde la sección "Certificados".
            </div>
          )}

          <button className="btn btn-primary" style={{ width: '100%', padding: '1rem', fontSize: '1rem', borderRadius: '12px' }} onClick={() => { setView('dashboard'); loadPortalData(); }}>
             Volver al Dashboard
          </button>
       </div>
    </div>
  );


  const handleSubmitReview = async () => {
    if (reviewStars === 0) return;
    setActionLoading(true);
    try {
      await employeeService.submitResena(activeCourse?.programada_id, reviewStars, reviewComment);
      setReviewSubmitted(true);
    } catch (err) {
      console.error('Review error:', err);
      // Silent fail - don't block the user
      setReviewSubmitted(true);
    } finally {
      setActionLoading(false);
    }
  };

  const renderReview = () => (
    <div style={{ maxWidth: '500px', margin: '0 auto', textAlign: 'center', animation: 'scaleUp 0.5s ease-out' }}>
       <div className="card-saas" style={{ padding: '3rem 2rem' }}>
          {!reviewSubmitted ? (
            <>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>💬</div>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>¿Qué te pareció el curso?</h2>
              <p style={{ color: 'var(--text-light)', marginBottom: '2rem', fontSize: '0.9rem' }}>
                Tu opinión es anónima y nos ayuda a mejorar.
              </p>
              
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                {[1, 2, 3, 4, 5].map(star => (
                  <button 
                    key={star}
                    onClick={() => setReviewStars(star)}
                    style={{
                      background: 'none', border: 'none', fontSize: '2.5rem', cursor: 'pointer',
                      transform: reviewStars >= star ? 'scale(1.2)' : 'scale(1)',
                      transition: 'transform 0.2s ease',
                      filter: reviewStars >= star ? 'none' : 'grayscale(1) opacity(0.3)'
                    }}
                  >⭐</button>
                ))}
              </div>
              
              {reviewStars > 0 && (
                <p style={{ color: 'var(--primary-color)', fontWeight: 600, marginBottom: '1.5rem' }}>
                  {reviewStars === 1 ? 'Malo' : reviewStars === 2 ? 'Regular' : reviewStars === 3 ? 'Bueno' : reviewStars === 4 ? 'Muy bueno' : 'Excelente'}
                </p>
              )}
              
              <textarea
                placeholder="Dejá un comentario (opcional)"
                value={reviewComment}
                onChange={e => setReviewComment(e.target.value)}
                maxLength={500}
                style={{
                  width: '100%', minHeight: '100px', padding: '1rem', borderRadius: '12px',
                  border: '1px solid var(--border-color)', fontFamily: 'inherit', fontSize: '0.9rem',
                  resize: 'vertical', marginBottom: '0.5rem', boxSizing: 'border-box'
                }}
              />
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'right', marginBottom: '2rem' }}>
                {reviewComment.length}/500
              </p>
              
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button 
                  className="btn btn-outline" 
                  style={{ flex: 1, padding: '1rem', borderRadius: '12px' }}
                  onClick={() => { setView('dashboard'); loadPortalData(); }}
                >
                  Omitir
                </button>
                <button 
                  className="btn btn-primary" 
                  style={{ flex: 1, padding: '1rem', borderRadius: '12px', opacity: reviewStars === 0 ? 0.5 : 1 }}
                  disabled={reviewStars === 0 || actionLoading}
                  onClick={handleSubmitReview}
                >
                  {actionLoading ? '...' : 'Enviar reseña'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🙏</div>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>¡Gracias por tu opinión!</h2>
              <p style={{ color: 'var(--text-light)', marginBottom: '2rem' }}>Tu reseña fue enviada de forma anónima.</p>
              <button 
                className="btn btn-primary" 
                style={{ width: '100%', padding: '1rem', fontSize: '1rem', borderRadius: '12px' }}
                onClick={() => { setView('dashboard'); loadPortalData(); }}
              >
                Volver al Dashboard
              </button>
            </>
          )}
       </div>
    </div>
  );

  const renderCertificados = () => (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <h1>Mis Certificados</h1>
          <p style={{ color: 'var(--text-light)', margin: 0 }}>Certificaciones oficiales vigentes.</p>
        </div>
        <button className="btn" style={{ background: 'white', border: '1px solid var(--border-color)' }} onClick={() => setView('dashboard')}>
          ← Volver
        </button>
      </div>

      {certificados.length === 0 ? (
        <EmptyState title="Cero certificados" description="Aún no tienes certificaciones emitidas." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {certificados.map(c => (
            <div key={c.id} className="card-saas" style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ fontSize: '1.5rem', background: '#EFF6FF', padding: '0.75rem', borderRadius: '10px' }}>🏆</div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: '0 0 0.5rem' }}>{c.capacitacion}</h4>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', marginBottom: '1.5rem' }}>
                  Emitido: {c.fecha_emision} <br/>
                  Vence: {c.fecha_vencimiento}
                </div>
                <button 
                  className="btn btn-text" 
                  style={{ paddingLeft: 0, color: 'var(--primary-color)' }}
                  onClick={() => handleDownloadCertificado(c)}
                  disabled={actionLoading}
                >
                   {actionLoading ? 'Generando...' : 'Descargar PDF →'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderFirma = () => (
    <div style={{ maxWidth: '600px', animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ marginBottom: '2rem' }}>
        <button className="btn btn-text" onClick={() => setView('dashboard')} style={{ paddingLeft: 0 }}>← Volver al Dashboard</button>
        <h1 style={{ marginTop: '0.5rem' }}>Mi Firma Digital</h1>
        <p style={{ color: 'var(--text-light)', margin: '0.25rem 0 0' }}>
          Tu firma se incluirá automáticamente en todos los certificados que se emitan a tu nombre.
        </p>
      </div>

      <SignaturePad 
        initialSignature={firma}
        onSave={handleSaveFirma}
        saving={firmaSaving}
      />

      {firma && (
        <div style={{
          marginTop: '1.5rem',
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: '12px',
          padding: '1rem',
          fontSize: '0.85rem',
          color: '#166534',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
        }}>
          ✅ Firma guardada correctamente. Se usará en futuros certificados.
        </div>
      )}
    </div>
  );

  if (loading) return <Loading message="Cargando portal laboral..." />;

  if (error && trainings.length === 0) {
    return (
      <DashboardLayout activeView={view} onSetView={setView}>
        <div style={{ padding: '3rem', textAlign: 'center', background: 'white', borderRadius: '16px', border: '1px solid #FEE2E2' }}>
           <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
           <h2 style={{ color: '#B91C1C' }}>Error de Conexión</h2>
           <p style={{ color: 'var(--text-light)', marginBottom: '2rem' }}>{error}</p>
           <button className="btn btn-primary" onClick={loadPortalData}>Intentar de nuevo</button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout activeView={view} onSetView={(v) => { setError(null); setView(v); }}>
      {error && (
        <div style={{ background: '#FEE2E2', color: '#B91C1C', padding: '1rem', borderRadius: '10px', marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', animation: 'slideDown 0.3s' }}>
          <span><strong>Error:</strong> {error}</span>
          <button style={{ border: 'none', background: 'none', color: '#B91C1C', fontWeight: 800, cursor: 'pointer' }} onClick={() => setError(null)}>×</button>
        </div>
      )}
      
      {view === 'dashboard' && renderDashboard()}
      {view === 'profile' && renderProfile()}
      {view === 'trainings' && renderTrainings()}
      {view === 'certificados' && renderCertificados()}
      {view === 'materials' && renderMaterials()}
      {view === 'evaluation' && renderEvaluation()}
      {view === 'result' && renderResult()}
        {view === 'review' && renderReview()}
      {view === 'firma' && renderFirma()}
    </DashboardLayout>
  );
}
