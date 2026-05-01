import { employeeMockData } from '../mocks/employeeMockData';
import { authService } from './authService';
import { authFetch } from '../utils/apiClient';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

const fetchWithAuth = async (url, options = {}) => {
  const headers = {
    ...options.headers,
    'Accept': 'application/json'
  };
  
  try {
    const res = await authFetch(url, { ...options, headers });
    if (!res.ok) {
      const errorBody = await res.text().catch(() => 'No response body');
      console.error(`API Error [${res.status}] at ${url}:`, errorBody);
      
      if (res.status === 401) {
        authService.logout();
        throw new Error('Sesión expirada. Por favor volvé a iniciar sesión');
      }
      throw new Error(`Error de servidor (${res.status}). Por favor intente más tarde.`);
    }
    return await res.json();
  } catch (err) {
    console.error('Fetch error:', err);
    if (err.message.includes('Failed to fetch')) {
        throw new Error('No se pudo conectar con el servidor. Verifique su conexión.');
    }
    throw err;
  }
};

export const employeeService = {
  getMisCapacitaciones: async () => {
    return await fetchWithAuth(`${API_URL}/empleados/me/capacitaciones`);
  },
  getMiProgreso: async () => {
    return await fetchWithAuth(`${API_URL}/empleados/me/progreso`);
  },
  getMisCertificados: async () => {
    return await fetchWithAuth(`${API_URL}/empleados/me/certificados`);
  },
  iniciarEvaluacion: async (asignacionId) => {
    return await fetchWithAuth(`${API_URL}/evaluacion/iniciar`, {
      method: 'POST',
      body: JSON.stringify({ asignacion_id: asignacionId })
    });
  },
  getPreguntasEvaluacion: async (intentoId) => {
    return await fetchWithAuth(`${API_URL}/evaluacion/intentos/${intentoId}/preguntas`);
  },
  responderPregunta: async (payload) => {
    return await fetchWithAuth(`${API_URL}/evaluacion/responder`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  finalizarEvaluacion: async (payload) => {
    return await fetchWithAuth(`${API_URL}/evaluacion/finalizar-intento`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  downloadCertificado: async (hash) => {
    const url = `${API_URL}/certificados/${hash}/pdf`;
    try {
      const response = await authFetch(url);

      if (!response.ok) {
          throw new Error('No se pudo descargar el certificado');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `Certificado_${hash}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Download error:', err);
      throw new Error('Error al descargar el archivo');
    }
  },

  // ─── New: Completion tracking ───
  markMaterialViewed: async (asignacionId) => {
    return await fetchWithAuth(`${API_URL}/empleados/me/capacitaciones/${asignacionId}/mark-material-viewed`, {
      method: 'POST'
    });
  },
  markCompleted: async (asignacionId) => {
    return await fetchWithAuth(`${API_URL}/empleados/me/capacitaciones/${asignacionId}/mark-completed`, {
      method: 'POST'
    });
  },

  // ─── New: Digital Signature ───
  uploadFirma: async (firmaBase64) => {
    return await fetchWithAuth(`${API_URL}/empleados/me/firma`, {
      method: 'POST',
      body: JSON.stringify({ firma_base64: firmaBase64 })
    });
  },
  getFirma: async () => {
    return await fetchWithAuth(`${API_URL}/empleados/me/firma`);
  }
};
