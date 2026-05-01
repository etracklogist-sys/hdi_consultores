import { materialsMockData } from '../mocks/materialsMockData';

let currentMaterials = [...materialsMockData];
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const materialService = {
  getMaterialesByCapacitacion: async (capacitacionId) => {
    await delay(300);
    return currentMaterials
      .filter(m => m.capacitacion_id == capacitacionId)
      .sort((a, b) => a.orden - b.orden);
  },
  
  createMaterial: async (capacitacionId, payload) => {
    await delay(400);
    const newMaterial = {
      ...payload,
      id: `mat-${Date.now()}`,
      capacitacion_id: capacitacionId
    };
    currentMaterials.push(newMaterial);
    return newMaterial;
  },
  
  updateMaterial: async (materialId, payload) => {
    await delay(400);
    const index = currentMaterials.findIndex(m => m.id === materialId);
    if (index === -1) throw new Error("Material no encontrado");
    currentMaterials[index] = { ...currentMaterials[index], ...payload };
    return currentMaterials[index];
  },
  
  deleteMaterial: async (materialId) => {
    await delay(400);
    currentMaterials = currentMaterials.filter(m => m.id !== materialId);
    return { success: true };
  }
};
