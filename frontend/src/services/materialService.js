import { authFetch } from '../utils/apiClient';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

export const materialService = {
  getMaterialesByCapacitacion: async (capacitacionId) => {
    const res = await authFetch(`${API_URL}/capacitaciones/${capacitacionId}/materiales`);
    if (!res.ok) {
      console.warn('Materials endpoint not available, returning empty');
      return [];
    }
    const data = await res.json();
    return data.filter(m => m.activo);
  },
  
  createMaterial: async (capacitacionId, payload) => {
    const res = await authFetch(`${API_URL}/capacitaciones/${capacitacionId}/materiales`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Error al crear material');
    }
    return res.json();
  },
  
  updateMaterial: async (materialId, payload) => {
    const res = await authFetch(`${API_URL}/capacitaciones/materiales/${materialId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Error al actualizar material');
    }
    return res.json();
  },
  
  deleteMaterial: async (materialId) => {
    const res = await authFetch(`${API_URL}/capacitaciones/materiales/${materialId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Error al eliminar material');
    }
    return res.json();
  }
};
