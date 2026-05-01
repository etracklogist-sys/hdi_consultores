import React, { useState, useEffect } from 'react';
import { adminService } from '../services/adminService';
import Loading from '../components/Loading';
import EmptyState from '../components/EmptyState';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export default function Vencimientos() {
  const [certificados, setCertificados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchVencimientos = async () => {
      try {
        const data = await adminService.getCertificados();
        setCertificados(data);
        setLoading(false);
      } catch (err) {
        console.error(err);
        setError("Error al cargar los certificados.");
        setLoading(false);
      }
    };
    fetchVencimientos();
  }, []);

  if (loading) return <Loading message="Cargando base de certificados..." />;
  if (error) return <EmptyState title="Error de conexión" description={error} />;

  return (
    <div className="admin-container">
      <div className="header-actions">
        <div>
          <h2>Vencimientos y Certificaciones</h2>
          <p className="subtitle">Registro global de credenciales emitidas</p>
        </div>
      </div>

      <div className="card">
        {certificados.length === 0 ? (
          <EmptyState title="Sin certificados" description="No se han emitido certificados todavía." />
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Empleado</th>
                <th>Cliente</th>
                <th>Capacitación</th>
                <th>Emisión</th>
                <th>Vencimiento</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {certificados.map(c => (
                <tr key={c.id}>
                  <td>#{c.id}</td>
                  <td>
                    <div style={{fontWeight: 500}}>{c.empleado_nombre}</div>
                    <div style={{fontSize: '0.8rem', color: 'var(--text-light)'}}>DNI: {c.empleado_dni}</div>
                  </td>
                  <td>{c.cliente_nombre}</td>
                  <td>{c.capacitacion_nombre}</td>
                  <td>{new Date(c.fecha_emision).toLocaleDateString()}</td>
                  <td>{new Date(c.fecha_vencimiento).toLocaleDateString()}</td>
                  <td>
                    <span className={`badge ${c.estado === 'VIGENTE' ? 'badge-success' : 'badge-warning'}`}>
                      {c.estado}
                    </span>
                  </td>
                  <td>
                    <a href={`${API_URL}/certificados/${c.hash_verificacion}/pdf`} target="_blank" rel="noreferrer" className="btn btn-primary" style={{fontSize: '0.8rem', padding: '0.4rem 0.8rem'}}>PDF</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
