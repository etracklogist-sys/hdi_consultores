export const employeeMockData = {
  currentEmployee: {
    id: 1,
    nombre_completo: 'Carlos Mendoza',
    email: 'carlos.mendoza@factory.com',
    cliente_id: 2
  },
  capacitacionesAsignadas: [
    { id: 101, capacitacion: 'Manejo de Cargas Pesadas', estado: 'Pendiente', curso_id: 1 },
    { id: 102, capacitacion: 'Prevención de Incendios', estado: 'Completado', nota: 9.5, curso_id: 2 }
  ],
  certificados: [
    { id: 55, capacitacion: 'Prevención de Incendios', vencimiento: '2027-03-24', hash: 'fb95f32a5e9' }
  ],
  preguntasEvaluacion: [
    { id: 1, texto: '¿Cuál es el ángulo correcto al levantar una caja?', opciones: [{ id: 1, texto: '90 grados' }, { id: 2, texto: '45 grados' }, { id: 3, texto: 'Cualquiera' }] },
    { id: 2, texto: '¿Se permite usar el cinturón lumbar en todo momento?', opciones: [{ id: 1, texto: 'Sí' }, { id: 2, texto: 'No, bajo ciertas condiciones' }] }
  ]
};
