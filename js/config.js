export const CONFIG = {
  USE_MOCK: true,
  API_BASE_URL: 'https://rutatrack-api.onrender.com/api',
  LATENCIA_MS: 250,
  POR_PAGINA: 8,
};

export const ESTADOS = {
  PENDIENTE: 'Pendiente',
  ASIGNADO: 'Asignado',
  EN_TRANSITO: 'En tránsito',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

export const TRANSICIONES = {
  PENDIENTE: ['ASIGNADO', 'CANCELADO'],
  ASIGNADO: ['EN_TRANSITO', 'CANCELADO'],
  EN_TRANSITO: ['ENTREGADO'],
  ENTREGADO: [],
  CANCELADO: [],
};

export const ROLES = {
  ADMINISTRADOR: 'Administrador',
  OPERADOR: 'Operador logístico',
  REPARTIDOR: 'Repartidor',
};
