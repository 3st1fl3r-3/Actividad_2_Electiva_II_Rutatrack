const CLAVE = 'rutatrack_sesion';

export function guardarSesion(sesion) {
  try { sessionStorage.setItem(CLAVE, JSON.stringify(sesion)); } catch { memoria = sesion; }
}

let memoria = null;
export function obtenerSesion() {
  try {
    const s = sessionStorage.getItem(CLAVE);
    return s ? JSON.parse(s) : memoria;
  } catch { return memoria; }
}

export function cerrarSesion() {
  try { sessionStorage.removeItem(CLAVE); } catch {}
  memoria = null;
}

export function usuarioActual() {
  return obtenerSesion()?.usuario ?? null;
}

export function inicioSegunRol(rol) {
  return rol === 'REPARTIDOR' ? 'mis-entregas.html' : 'pedidos.html';
}
