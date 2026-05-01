import React, { useEffect, useState, useRef, useCallback } from 'react';
import { authFetch } from '../utils/apiClient';
import { useSearchParams, useNavigate } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export default function AsignacionMasiva() {
  const [searchParams] = useSearchParams();
  const preloadedClienteId = searchParams.get('cliente_id') || '';

  const [step, setStep] = useState(1);
  const [clientes, setClientes] = useState([]);
  const [capacitaciones, setCapacitaciones] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const navigate = useNavigate();

  const [selectedCliente, setSelectedCliente] = useState(preloadedClienteId);
  const [selectedCaps, setSelectedCaps] = useState([]);
  const [selectedEmps, setSelectedEmps] = useState([]);


  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchClientes = async () => {
      try {
        const res = await authFetch(`${API_URL}/clientes/`);
        if (res.ok) setClientes(await res.json());
      } catch (e) { console.error(e); }
    };
    fetchClientes();
  }, []);

  // When client changes: load compatible trainings
  useEffect(() => {
    const fetchCapacitaciones = async () => {
      if (selectedCliente) {
        try {
          const res = await authFetch(`${API_URL}/capacitaciones/?cliente_id=${selectedCliente}`);
          if (res.ok) setCapacitaciones(await res.json());
          else setCapacitaciones([]);
        } catch (e) {
          setCapacitaciones([]);
        }
      } else {
        setCapacitaciones([]);
      }
      setSelectedCaps([]);
    };
    fetchCapacitaciones();
  }, [selectedCliente]);

  // When trainings change: load eligible employees
  useEffect(() => {
    const fetchEmpleadosElegibles = async () => {
      if (selectedCliente && selectedCaps.length > 0) {
        try {
          const res = await authFetch(`${API_URL}/asignaciones/elegibles?cliente_id=${selectedCliente}&capacitacion_ids=${selectedCaps.join(',')}`);
          if (res.ok) {
            const data = await res.json();
            setEmpleados(data);
            setSelectedEmps(data.map(e => e.id));
          } else {
            setEmpleados([]);
          }
        } catch (e) { setEmpleados([]); }
      } else if (selectedCliente) {
        // Load all employees when no training selected yet
        try {
          const res = await authFetch(`${API_URL}/clientes/${selectedCliente}/empleados`);
          if (res.ok) {
            const data = await res.json();
            setEmpleados(data);
            setSelectedEmps(data.map(e => e.id));
          } else {
            setEmpleados([]);
          }
        } catch (e) { setEmpleados([]); }
      }
    };
    fetchEmpleadosElegibles();
  }, [selectedCliente, selectedCaps]);

  // If preloaded, auto-advance
  useEffect(() => {
    if (preloadedClienteId && clientes.length > 0) {
      setSelectedCliente(preloadedClienteId);
    }
  }, [preloadedClienteId, clientes]);

  const toggleCap = (id) => setSelectedCaps(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleEmp = (id) => setSelectedEmps(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  // Select-all checkbox ref for indeterminate state
  const selectAllRef = useRef(null);
  const allSelected = empleados.length > 0 && selectedEmps.length === empleados.length;
  const noneSelected = selectedEmps.length === 0;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = !allSelected && !noneSelected;
    }
  }, [allSelected, noneSelected]);

  const handleSelectAllToggle = useCallback(() => {
    if (allSelected) {
      setSelectedEmps([]);
    } else {
      setSelectedEmps(empleados.map(e => e.id));
    }
  }, [allSelected, empleados]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const body = {
        cliente_id: parseInt(selectedCliente),
        capacitacion_ids: selectedCaps,
        empleado_ids: selectedEmps
      };
      const res = await authFetch(`${API_URL}/asignaciones/masivas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Error en asignación');
      }
      const data = await res.json();
      setResult(data);
      setStep(5);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const clienteObj = clientes.find(c => c.id === parseInt(selectedCliente));
  const clienteName = clienteObj?.razon_social || '';

  return (
    <div>
      <h2 style={{margin: '0 0 0.25rem'}}>Asignación de Capacitaciones</h2>
      <p style={{color: 'var(--text-light)', marginBottom: '2rem'}}>Asigne capacitaciones de forma masiva o manual a empleados de un cliente.</p>

      {/* Step indicator */}
      <div style={{display: 'flex', gap: '0.5rem', marginBottom: '2rem'}}>
        {[1,2,3,4].map(s => (
          <div key={s} style={{flex: 1, height: '4px', borderRadius: '2px', background: step >= s ? 'var(--secondary-color)' : '#e2e8f0'}} />
        ))}
      </div>

      {error && <div style={{padding: '0.75rem', marginBottom: '1rem', background: '#ffe0e0', color: '#c00', borderRadius: '4px'}}>{error}</div>}

      {/* STEP 1: Select Client */}
      {step === 1 && (
        <div className="card">
          <h3 style={{marginTop: 0}}>Paso 1: Seleccionar Cliente</h3>
          <label>Cliente <span style={{color:'#c00'}}>*</span></label>
          <select value={selectedCliente} onChange={e => setSelectedCliente(e.target.value)} style={{width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '1rem'}}>
            <option value="">-- Seleccionar cliente --</option>
            {clientes.map(c => <option key={c.id} value={c.id}>{c.razon_social} {c.rubro_nombre ? `(${c.rubro_nombre})` : ''}</option>)}
          </select>

          {selectedCliente && clienteObj && (
            <div style={{padding: '0.75rem', background: '#f0f9ff', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem'}}>
              <strong>Rubro:</strong> {clienteObj.rubro_nombre || 'Sin rubro'} · 
              Solo se mostrarán capacitaciones compatibles con este rubro.
            </div>
          )}

          <button className="btn btn-primary" disabled={!selectedCliente} onClick={() => setStep(2)}>Siguiente →</button>
        </div>
      )}

      {/* STEP 2: Select Capacitaciones (filtered by client rubro) */}
      {step === 2 && (
        <div className="card">
          <h3 style={{marginTop: 0}}>Paso 2: Seleccionar Capacitaciones</h3>
          <p style={{color: 'var(--text-light)', marginBottom: '1rem'}}>
            Capacitaciones compatibles con <strong>{clienteName}</strong>
            {clienteObj?.rubro_nombre && <> (Rubro: <strong>{clienteObj.rubro_nombre}</strong>)</>}
          </p>
          
          <div style={{maxHeight: '350px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px'}}>
            {capacitaciones.map(cap => (
              <label key={cap.id} style={{display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', background: selectedCaps.includes(cap.id) ? '#f0f9ff' : 'transparent'}}>
                <input type="checkbox" checked={selectedCaps.includes(cap.id)} onChange={() => toggleCap(cap.id)} />
                <div style={{flex: 1}}>
                  <div style={{fontWeight: 500}}>{cap.nombre}</div>
                  <div style={{fontSize: '0.8rem', color: 'var(--text-light)', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem'}}>
                    <span>{cap.modalidad} · {cap.duracion_horas}h</span>
                    {cap.rubro_nombre && <span style={{background: '#e0f2fe', color: '#0369a1', padding: '0.1rem 0.4rem', borderRadius: '3px'}}>Rubro: {cap.rubro_nombre}</span>}
                    {cap.area_nombre && <span style={{background: '#f0fdf4', color: '#166534', padding: '0.1rem 0.4rem', borderRadius: '3px'}}>Área: {cap.area_nombre}</span>}
                  </div>
                </div>
              </label>
            ))}
            {capacitaciones.length === 0 && <div style={{padding: '2rem', textAlign: 'center', color: 'var(--text-light)'}}>No hay capacitaciones compatibles con este cliente</div>}
          </div>

          <div style={{display: 'flex', gap: '1rem', marginTop: '1.5rem'}}>
            <button className="btn" onClick={() => setStep(1)}>← Atrás</button>
            <button className="btn btn-primary" disabled={selectedCaps.length === 0} onClick={() => setStep(3)}>Siguiente →</button>
          </div>
        </div>
      )}

      {/* STEP 3: Select Employees (filtered by area eligibility) */}
      {step === 3 && (
        <div className="card">
          <h3 style={{marginTop: 0}}>Paso 3: Seleccionar Empleados</h3>
          
          {selectedCaps.some(id => capacitaciones.find(c => c.id === id)?.area_nombre) && (
            <div style={{padding: '0.75rem', background: '#fefce8', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem', border: '1px solid #fde68a'}}>
              ⚠️ Se muestran solo empleados elegibles según las áreas de las capacitaciones seleccionadas.
            </div>
          )}

          <div style={{maxHeight: '350px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px'}}>
            {/* Header: Select All */}
            {empleados.length > 0 && (
              <label style={{display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 1rem', borderBottom: '2px solid var(--border-color)', cursor: 'pointer', background: '#f8fafc', position: 'sticky', top: 0, zIndex: 1}}>
                <input
                  type="checkbox"
                  ref={selectAllRef}
                  checked={allSelected}
                  onChange={handleSelectAllToggle}
                />
                <span style={{fontWeight: 600, fontSize: '0.85rem'}}>Seleccionar todos</span>
                <span style={{marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--text-light)'}}>
                  {selectedEmps.length} de {empleados.length}
                </span>
              </label>
            )}
            {/* Employee rows */}
            {empleados.map(emp => (
              <label key={emp.id} style={{display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 1rem', borderBottom: '1px solid var(--border-color)', cursor: 'pointer', background: selectedEmps.includes(emp.id) ? '#f0f9ff' : 'transparent'}}>
                <input type="checkbox" checked={selectedEmps.includes(emp.id)} onChange={() => toggleEmp(emp.id)} />
                <span style={{fontWeight: 500}}>{emp.nombre_completo}</span>
                <span style={{color: 'var(--text-light)', fontSize: '0.8rem'}}>{emp.area_nombre || 'Sin área'}</span>
              </label>
            ))}
            {empleados.length === 0 && <div style={{padding: '1.5rem', textAlign: 'center', color: 'var(--text-light)'}}>No hay empleados elegibles para las capacitaciones seleccionadas.</div>}
          </div>

          <div style={{display: 'flex', gap: '1rem', marginTop: '1.5rem'}}>
            <button className="btn" onClick={() => setStep(2)}>← Atrás</button>
            <button className="btn btn-primary" disabled={selectedEmps.length === 0} onClick={() => setStep(4)}>Siguiente →</button>
          </div>
        </div>
      )}

      {/* STEP 4: Confirm */}
      {step === 4 && (
        <div className="card">
          <h3 style={{marginTop: 0}}>Paso 4: Confirmar Asignación</h3>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem'}}>
            <div style={{padding: '1rem', background: '#f8fafc', borderRadius: '8px'}}>
              <div style={{color: 'var(--text-light)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.25rem'}}>Cliente</div>
              <div style={{fontWeight: 600}}>{clienteName}</div>
            </div>
            <div style={{padding: '1rem', background: '#f8fafc', borderRadius: '8px'}}>
              <div style={{color: 'var(--text-light)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.25rem'}}>Empleados</div>
              <div style={{fontWeight: 600}}>{selectedEmps.length} de {empleados.length} seleccionados</div>
            </div>
            <div style={{padding: '1rem', background: '#f8fafc', borderRadius: '8px'}}>
              <div style={{color: 'var(--text-light)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.25rem'}}>Capacitaciones</div>
              <div style={{fontWeight: 600}}>{selectedCaps.length} seleccionadas</div>
              <div style={{fontSize: '0.8rem', color: 'var(--text-light)', marginTop: '0.25rem'}}>
                {selectedCaps.map(id => capacitaciones.find(c => c.id === id)?.nombre).filter(Boolean).join(', ')}
              </div>
            </div>
            <div style={{padding: '1rem', background: '#f8fafc', borderRadius: '8px'}}>
              <div style={{color: 'var(--text-light)', fontSize: '0.8rem', textTransform: 'uppercase', marginBottom: '0.25rem'}}>Empleados</div>
              <div style={{fontWeight: 600}}>{selectedEmps.length}</div>
            </div>
          </div>

          <div style={{display: 'flex', gap: '1rem'}}>
            <button className="btn" onClick={() => setStep(3)} disabled={submitting}>← Atrás</button>
            <button className="btn btn-success" onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Procesando...' : 'Confirmar y Asignar'}
            </button>
          </div>
        </div>
      )}

      {/* STEP 5: Result */}
      {step === 5 && result && (
        <div className="card" style={{textAlign: 'center'}}>
          <div style={{fontSize: '3rem', marginBottom: '0.5rem'}}>✅</div>
          <h3 style={{marginTop: 0}}>Asignación Completada</h3>
          <p style={{fontSize: '1.1rem'}}>{result.message}</p>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginTop: '1.5rem', maxWidth: '500px', margin: '1.5rem auto 0'}}>
            <div style={{padding: '1rem', background: '#f0fdf4', borderRadius: '8px'}}>
              <div style={{fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-green)'}}>{result.created}</div>
              <div style={{fontSize: '0.8rem', color: 'var(--text-light)'}}>Nuevas</div>
            </div>
            <div style={{padding: '1rem', background: '#fefce8', borderRadius: '8px'}}>
              <div style={{fontSize: '1.5rem', fontWeight: 700, color: '#ca8a04'}}>{result.skipped}</div>
              <div style={{fontSize: '0.8rem', color: 'var(--text-light)'}}>Duplicadas</div>
            </div>
            <div style={{padding: '1rem', background: '#fef2f2', borderRadius: '8px'}}>
              <div style={{fontSize: '1.5rem', fontWeight: 700, color: '#dc2626'}}>{result.ineligible || 0}</div>
              <div style={{fontSize: '0.8rem', color: 'var(--text-light)'}}>Inelegibles</div>
            </div>
          </div>
          <div style={{display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2.5rem', flexWrap: 'wrap'}}>
            {selectedEmps.length === 1 ? (
              <button 
                className="btn btn-primary" 
                onClick={() => navigate(`/admin/empleados/${selectedEmps[0]}`)}
              >
                Ver Ficha de Empleado
              </button>
            ) : (
              <button 
                className="btn btn-primary" 
                onClick={() => navigate('/admin/asignaciones')}
              >
                Ver Listado de Asignaciones
              </button>
            )}
            
            <button 
              className="btn btn-outline" 
              onClick={() => { 
                setStep(1); 
                setResult(null); 
                setSelectedCaps([]); 
                setSelectedEmps([]); 
                setSelectedCliente(preloadedClienteId || ''); 
              }}
            >
              Asignar otra capacitación
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
