import React, { useState, useEffect } from 'react';
import { authFetch } from '../utils/apiClient';
import { useParams, Link } from 'react-router-dom';
import Loading from '../components/Loading';
import ErrorState from '../components/ErrorState';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export default function VerificarCertificado() {
  const { codigo } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCert = async () => {
      try {
        const res = await authFetch(`${API_URL}/certificados/verificar/${codigo}`);
        if (!res.ok) {
          throw new Error('Certificado no encontrado o enlace inválido');
        }
        const cert = await res.json();
        setData(cert);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };
    fetchCert();
  }, [codigo]);

  if (loading) return <div style={{height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc'}}><Loading message="Consultando blockchain y registros criptográficos..." /></div>;

  return (
    <div style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '2rem'}}>
      <div style={{maxWidth: '600px', width: '100%'}}>
        <div style={{textAlign: 'center', marginBottom: '2rem'}}>
          <div style={{fontWeight: 900, fontSize: '2rem', letterSpacing: '-1px', color: 'var(--primary-color)'}}>HDI Consultores</div>
          <p style={{color: 'var(--text-light)', margin: 0}}>Portal de Verificación Digital</p>
        </div>

        {error ? (
          <div className="card" style={{borderTop: '4px solid var(--accent-red)', textAlign: 'center', padding: '3rem 2rem'}}>
            <div style={{fontSize: '4rem', marginBottom: '1rem'}}>❌</div>
            <h2 style={{color: 'var(--text-dark)', margin: '0 0 1rem 0'}}>Verificación Fallida</h2>
            <p style={{color: 'var(--text-light)', marginBottom: '2rem'}}>{error}</p>
            <Link to="/" className="btn" style={{background: '#f1f5f9'}}>Volver al inicio</Link>
          </div>
        ) : (
          <div className="card" style={{borderTop: `4px solid ${data.valido ? 'var(--accent-green)' : 'var(--accent-red)'}`, padding: '0', overflow: 'hidden'}}>
            
            <div style={{padding: '2.5rem', textAlign: 'center', background: data.valido ? '#f0fdf4' : '#fef2f2', borderBottom: '1px solid var(--border-color)'}}>
              <div style={{fontSize: '4rem', marginBottom: '1rem'}}>{data.valido ? '✅' : '⚠️'}</div>
              <h2 style={{margin: '0 0 0.5rem 0', color: data.valido ? '#166534' : '#991b1b'}}>
                {data.valido ? 'Certificado Oficial Válido' : 'Certificado Vencido / Inválido'}
              </h2>
              <p style={{margin: 0, color: data.valido ? '#15803d' : '#b91c1c', fontWeight: 500}}>
                {data.valido ? 'Este documento digital está activo en nuestros registros.' : 'Este documento ya no posee validez oficial activa.'}
              </p>
            </div>

            <div style={{padding: '2.5rem'}}>
              <div style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
                <div>
                  <div style={{fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-light)', fontWeight: 600, marginBottom: '0.2rem'}}>Otorgado A</div>
                  <div style={{fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-dark)'}}>{data.empleado}</div>
                  <div style={{fontSize: '0.9rem', color: 'var(--text-light)'}}>DNI: {data.dni}</div>
                </div>

                <div>
                  <div style={{fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-light)', fontWeight: 600, marginBottom: '0.2rem'}}>Organización</div>
                  <div style={{fontSize: '1.1rem', color: 'var(--text-dark)'}}>{data.cliente}</div>
                </div>

                <div>
                  <div style={{fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-light)', fontWeight: 600, marginBottom: '0.2rem'}}>Módulo de Especialización</div>
                  <div style={{fontSize: '1.1rem', color: 'var(--primary-color)', fontWeight: 600}}>{data.entrenamiento}</div>
                </div>

                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem', paddingTop: '1.5rem', borderTop: '1px dashed var(--border-color)'}}>
                  <div>
                    <div style={{fontSize: '0.8rem', color: 'var(--text-light)', marginBottom: '0.2rem'}}>Fecha de Emisión</div>
                    <div style={{fontWeight: 500}}>{new Date(data.fecha_emision).toLocaleDateString()}</div>
                  </div>
                  <div>
                    <div style={{fontSize: '0.8rem', color: 'var(--text-light)', marginBottom: '0.2rem'}}>Válido Hasta</div>
                    <div style={{fontWeight: 500, color: data.valido ? 'var(--text-dark)' : 'var(--accent-red)'}}>{new Date(data.fecha_vencimiento).toLocaleDateString()}</div>
                  </div>
                </div>

                <div style={{marginTop: '1rem', paddingTop: '1.5rem', borderTop: '1px dashed var(--border-color)', textAlign: 'center'}}>
                  <img src="/firma_instructor.png" alt="Firma del Instructor / Representante" style={{height: '95px', objectFit: 'contain', marginBottom: '0.5rem'}} />
                  <div style={{fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-light)', fontWeight: 600, marginBottom: '0.2rem'}}>Instructor / Representante</div>
                  <div style={{fontWeight: 700, color: 'var(--text-dark)'}}>HDI Consultores</div>
                  <div style={{fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '0.25rem'}}>Colegio Profesional de Seguridad e Higiene de la Provincia de Buenos Aires - LHS-004308 PBA</div>
                  <div style={{fontSize: '0.8rem', color: 'var(--text-light)'}}>COPIME - L002175</div>
                </div>

                <div style={{marginTop: '1.5rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px', wordBreak: 'break-all'}}>
                  <div style={{fontSize: '0.75rem', color: 'var(--text-light)', marginBottom: '0.25rem', textTransform: 'uppercase', fontWeight: 600}}>Hash Criptográfico SHA-256</div>
                  <code style={{fontSize: '0.8rem', color: 'var(--text-dark)', fontFamily: 'monospace'}}>{data.hash_verificacion}</code>
                </div>

                <div style={{marginTop: '1.5rem'}}>
                  <a href={`${API_URL}/certificados/${data.hash_verificacion}/pdf`} target="_blank" rel="noreferrer" className="btn btn-primary" style={{width: '100%', display: 'block', textAlign: 'center'}}>
                    Ver Copia Original en PDF
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
