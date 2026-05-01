export const adminMockData = {
  capacitaciones: [
    { id: 1, nombre: 'Prevención de Incendios', descripcion: 'Curso técnico B2B', duracion_horas: 2, vigencia_meses: 12, requiere_evaluacion: true, activa: true },
    { id: 2, nombre: 'Primeros Auxilios Básicos', descripcion: 'Soporte vital', duracion_horas: 4, vigencia_meses: 24, requiere_evaluacion: true, activa: true }
  ],
  preguntas: {
    1: [
      { id: 1, texto: '¿Cuál es el color del extintor A?', opciones_json: '[{"id":1,"texto":"Rojo","es_correcta":true},{"id":2,"texto":"Azul","es_correcta":false}]' }
    ]
  },
  sesiones: [
    { id: 1, fecha: '2026-03-24T09:00:00Z', modalidad: 'PRESENCIAL', estado: 'PROGRAMADA', capacitacion: { nombre: 'Riesgos Laborales Grales' }, cliente: { razon_social: 'TechCorp S.A.' } }
  ],
  participantesSesion: {
    1: [
      { id: 1, empleado_id: 1, nombre_completo: 'María Rodríguez', email: 'maria@techcorp.com', emp_id: 101 }
    ]
  },
  candidatos: [
    { id: 2, nombre_completo: 'Juan Pérez', email: 'juan@techcorp.com', emp_id: 102 },
    { id: 3, nombre_completo: 'Ana Gómez', email: 'ana@techcorp.com', emp_id: 103 }
  ]
};
