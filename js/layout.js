import { ROLES } from './config.js';
import { obtenerSesion, cerrarSesion, inicioSegunRol } from './sesion.js';
import { reiniciarDatos } from './api.js';
import { esc, confirmar } from './ui.js';

const MENU = [
  { id: 'pedidos', texto: 'Pedidos', icono: '📦', href: 'pedidos.html', roles: ['ADMINISTRADOR', 'OPERADOR'] },
  { id: 'repartidores', texto: 'Repartidores', icono: '🚚', href: 'repartidores.html', roles: ['ADMINISTRADOR', 'OPERADOR'] },
  { id: 'usuarios', texto: 'Usuarios', icono: '👤', href: 'usuarios.html', roles: ['ADMINISTRADOR'] },
  { id: 'mis-entregas', texto: 'Mis entregas', icono: '🧭', href: 'mis-entregas.html', roles: ['REPARTIDOR'] },
  { id: 'seguimiento', texto: 'Consulta pública', icono: '🔎', href: 'seguimiento.html', roles: ['ADMINISTRADOR', 'OPERADOR', 'REPARTIDOR'] },
];

export function iniciarPagina({ roles = [], activo = '' } = {}) {
  const sesion = obtenerSesion();
  if (!sesion?.token) {
    location.replace(`login.html?volver=${encodeURIComponent(location.pathname.split('/').pop() + location.search)}`);
    throw new Error('Sin sesión');
  }
  const usuario = sesion.usuario;
  if (roles.length && !roles.includes(usuario.rol)) {
    location.replace(inicioSegunRol(usuario.rol));
    throw new Error('Rol sin acceso');
  }
  pintarMenu(usuario, activo);
  return usuario;
}

function pintarMenu(usuario, activo) {
  const items = MENU.filter(m => m.roles.includes(usuario.rol));
  const sidebar = document.getElementById('sidebar');
  sidebar.innerHTML = `
    <div class="marca"><strong>RutaTrack</strong><span>Seguimiento de pedidos y rutas</span></div>
    <nav aria-label="Menú principal">
      <ul class="menu">
        ${items.map(m => `<li><a href="${m.href}" class="${m.id === activo ? 'activo' : ''}" ${m.id === activo ? 'aria-current="page"' : ''}>
          <span aria-hidden="true">${m.icono}</span>${m.texto}</a></li>`).join('')}
      </ul>
    </nav>
    <div class="usuario-actual">
      <b>${esc(usuario.nombre)}</b>${ROLES[usuario.rol]}
      <button class="btn btn-sec btn-chico" id="btn-salir">Cerrar sesión</button>
      <button class="btn-link" id="btn-reiniciar" style="color:#a9c3dc;font-size:.78rem;margin-top:6px">Restablecer datos de prueba</button>
    </div>`;

  const topbar = document.getElementById('topbar');
  topbar.innerHTML = `<strong>RutaTrack</strong><button id="btn-menu" aria-expanded="false" aria-controls="sidebar">☰ Menú</button>`;
  document.getElementById('btn-menu').addEventListener('click', e => {
    const abierto = sidebar.classList.toggle('abierto');
    e.currentTarget.setAttribute('aria-expanded', abierto);
  });

  document.getElementById('btn-salir').addEventListener('click', () => {
    cerrarSesion();
    location.href = 'login.html';
  });
  document.getElementById('btn-reiniciar').addEventListener('click', async () => {
    const ok = await confirmar('Restablecer datos', 'Se borrarán los cambios hechos en este navegador y se cargarán de nuevo los datos de /data.', 'Restablecer', true);
    if (ok) { reiniciarDatos(); location.reload(); }
  });
}
