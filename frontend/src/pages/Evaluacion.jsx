import React, { useState } from 'react';

// Vista simplificada para un participante (no tiene menú administrativo)
export default function EvaluacionEmpleado() {
  const [step, setStep] = useState(0);

  const finalizarEvaluacion = () => {
      // API call al backend de "Finalizar /api/v1/evaluacion/finalizar/{intento_id}"
      alert("Evaluación finalizada! Has avanzado en un 100%");
      setStep(3); // Resultado
  }

  return (
    <div style={{background: '#f4f7f6', minHeight: '100vh', display: 'flex', flexDirection: 'column'}}>
      {/* Header Simplificado */}
      <header style={{background: 'white', padding: '1rem 2rem', borderBottom: '1px solid var(--border-color)', textAlign: 'center'}}>
        <h3 style={{margin: 0, color: 'var(--primary-color)'}}>Capacitación en Primeros Auxilios</h3>
      </header>

      <main style={{flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem'}}>
        
        {step === 0 && (
          <div className="card" style={{width: '600px', textAlign: 'center'}}>
            <h2 style={{color: 'var(--primary-color)'}}>Instrucciones de Evaluación</h2>
            <p style={{color: 'var(--text-light)', marginBottom: '2rem'}}>
              Recuerda que tienes únicamente un (1) intento activo para superar este examen de conformidad y obtener el certificado vigente. La nota mínima para aprobar es de 7.5.
            </p>
            <button className="btn btn-primary" onClick={() => setStep(1)} style={{fontSize: '1.1rem', padding: '0.75rem 2rem'}}>
              Iniciar Intento
            </button>
          </div>
        )}

        {(step === 1 || step === 2) && (
          <div style={{width: '600px'}}>
             {/* Progress Bar */}
             <div style={{background: '#e0e6ed', borderRadius: '4px', height: '8px', marginBottom: '2rem', overflow: 'hidden'}}>
               <div style={{background: 'var(--accent-green)', width: step === 1 ? '50%' : '100%', height: '100%', transition: 'all 0.3s'}}></div>
             </div>

             <div className="card">
                <p style={{fontWeight: 600, color: 'var(--text-light)', fontSize: '0.85rem'}}>Pregunta {step} de 2</p>
                <h3 style={{marginTop: '0.5rem', marginBottom: '2rem'}}>¿Cuál es el primer paso en el protocolo PAS ante un accidente laboral?</h3>
                
                {/* Opciones */}
                <div style={{display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '2rem'}}>
                  <label className="card" style={{padding: '1rem', cursor: 'pointer', border: '1px solid var(--border-color)', margin: 0}}>
                    <input type="radio" name="respuesta" style={{width: 'auto', marginRight: '1rem'}}/> Proteger el área
                  </label>
                  <label className="card" style={{padding: '1rem', cursor: 'pointer', border: '1px solid var(--border-color)', margin: 0}}>
                    <input type="radio" name="respuesta" style={{width: 'auto', marginRight: '1rem'}}/> Avisar a servicios médicos
                  </label>
                </div>

                <div style={{display: 'flex', justifyContent: 'space-between'}}>
                  <button className="btn" disabled={step === 1}>Anterior</button>
                  {step === 1 ? (
                    <button className="btn btn-primary" onClick={() => setStep(2)}>Siguiente</button>
                  ) : (
                    <button className="btn btn-success" onClick={finalizarEvaluacion}>Finalizar y Ver Nota</button>
                  )}
                </div>
             </div>
          </div>
        )}

        {step === 3 && (
          <div className="card" style={{width: '600px', textAlign: 'center'}}>
             <div style={{background: '#e8f8f5', width: '80px', height: '80px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto'}}>
               <h1 style={{color: 'var(--accent-green)', margin: 0}}>10</h1>
             </div>
             <h2>¡Aprobado Exitosamente!</h2>
             <p style={{color: 'var(--text-light)'}}>Tu certificado ha sido generado en la cadena de bloques o hash válido.</p>
             <button className="btn btn-success" style={{marginTop: '1rem'}}>📄 Descargar Certificado</button>
          </div>
        )}

      </main>
    </div>
  );
}
