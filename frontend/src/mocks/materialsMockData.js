export const materialsMockData = [
  {
    id: "mat-1",
    capacitacion_id: 1, // matches Prior mock training "Prevención de Incendios"
    titulo: "Manual Base de Seguridad",
    descripcion: "Documento oficial con normativas esenciales",
    tipo: "pdf",
    url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    orden: 1,
    activo: true
  },
  {
    id: "mat-2",
    capacitacion_id: 1,
    titulo: "Uso de Extintores en Práctica",
    descripcion: "Video explicativo sobre tipos de fuego",
    tipo: "video",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    orden: 2,
    activo: true
  },
  {
    id: "mat-3",
    capacitacion_id: 2, // "Primeros Auxilios Básicos"
    titulo: "Guía RCP",
    descripcion: "Póster de referencia rápida",
    tipo: "imagen",
    url: "https://via.placeholder.com/800x600.png?text=Guia+RCP",
    orden: 1,
    activo: true
  }
];
