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
  const [view, setView] = useState('dashboard'); // 'dashboard', 'trainings', 'certificados', 'materials', 'evaluation', 'result', 'firma'
  
  // Data States
  const [trainings, setTrainings] = useState([]);
  const [progreso, setProgreso] = useState({ total_asignadas: 0, total_completadas: 0, porcentaje_cumplimiento: 0 });
  const [certificados, setCertificados] = useState([]);
  
  // Interaction States
  const [activeCourse, setActiveCourse] = useState(null);
  const [courseMaterials, setCourseMaterials] = useState([]);
  const [activeIntento, setActiveIntento] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [evalProgress, setEvalProgress] = useState(null);
  const [finalResult, setFinalResult] = useState(null);
  
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
      // If training requires evaluation and material has been viewed, skip to eval
      if (training.requiere_evaluacion && training.material_viewed) {
        handleStartEvaluation(training);
        return;
      }
      
      // Fetch materials from mock service using capacitacion catalog id
      const mats = await materialService.getMaterialesByCapacitacion(training.id); 
      setCourseMaterials(mats.filter(m => m.activo));
      
      // Mark material as viewed on the backend (does NOT complete the training)
      employeeService.markMaterialViewed(training.id).catch(() => {});
      
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
      const qData = await employeeService.getPreguntasEvaluacion(training.intento_id);
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', marginBottom: '2.5rem' }}>
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

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: '2rem' }}>
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
          {activeCourse?.requiere_evaluacion && (
            <button className="btn btn-primary" style={{ padding: '0.75rem 1.5rem', fontSize: '0.9rem' }} onClick={() => handleStartEvaluation()}>
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
        background: '#f0fdf4',
        border: '1px solid #bbf7d0',
        borderRadius: '12px',
        padding: '0.75rem 1.25rem',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '0.85rem',
        color: '#166534',
      }}>
        ✅ Material registrado como visto
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
                <a href={mat.url} target="_blank" rel="noopener noreferrer" className="btn" style={{ width: '100%', marginTop: '1rem', background: '#F8FAFC' }}>
                  Abrir Recurso
                </a>
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
      {view === 'trainings' && renderTrainings()}
      {view === 'certificados' && renderCertificados()}
      {view === 'materials' && renderMaterials()}
      {view === 'evaluation' && renderEvaluation()}
      {view === 'result' && renderResult()}
      {view === 'firma' && renderFirma()}
    </DashboardLayout>
  );
}
