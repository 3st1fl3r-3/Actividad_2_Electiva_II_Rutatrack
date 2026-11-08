import { iniciarPagina } from '../layout.js';
import { miPerfilRepartidor, pedidosDeRepartidor, cambiarEstado, registrarUbicacion, estadosPermitidos } from '../api.js';
import { ESTADOS } from '../config.js';
import { $, esc, badgeEstado, formatoFecha, toast, confirmar, mostrarError, conCarga } from '../ui.js';
import { obtenerUbicacionNavegador } from '../geolocalizacion.js';

const usuario = iniciarPagina({ roles: ['REPARTIDOR'], activo: 'mis-entregas' });
const lista = $('#lista');
let perfil = null;

const TEXTO_ACCION = { EN_TRANSITO: 'Iniciar ruta', ENTREGADO: 'Confirmar entrega' };

async function cargar() {
  try {
    perfil = await miPerfilRepartidor();
    const pedidos = await pedidosDeRepartidor(perfil.id, $('#ver-finalizados').checked);
    $('#resumen').textContent = `${perfil.activos} pedido(s) activo(s) · capacidad ${perfil.capacidadMax}`;
    lista.innerHTML = pedidos.length ? pedidos.map(p => {
      const siguientes = estadosPermitidos(p, usuario.rol);
      return `
      <article class="pedido-card">
        <header><b>${p.codigo}</b>${badgeEstado(p.estado)}</header>
        <p class="texto-suave">
          Destino: <b style="color:var(--texto)">${esc(p.destino)}</b><br>
          Cliente: ${esc(p.cliente?.nombre)} · ${esc(p.telefonoContacto)}<br>
          ${esc(p.descripcion)}<br>
          Actualizado: ${formatoFecha(p.fechaActualizacion)}
        </p>
        <div class="acciones">
          ${siguientes.map(e => `<button class="btn ${e === 'ENTREGADO' ? 'btn-exito' : ''}" data-estado="${e}" data-id="${p.id}" data-codigo="${p.codigo}">${TEXTO_ACCION[e] ?? ESTADOS[e]}</button>`).join('')}
          ${p.estado === 'EN_TRANSITO' ? `<button class="btn btn-sec" data-ubicacion="${p.id}">📍 Registrar ubicación</button>` : ''}
          <a class="btn btn-sec" href="pedido-detalle.html?id=${p.id}">Ver detalle</a>
        </div>
      </article>`;
    }).join('') : '<div class="tarjeta vacio">No tiene pedidos para mostrar.</div>';
  } catch (e) {
    mostrarError(e);
    lista.innerHTML = `<div class="aviso error">${esc(e.message)}</div>`;
  }
}

lista.addEventListener('click', async e => {
  const b = e.target.closest('[data-estado]');
  if (b) {
    const nuevo = b.dataset.estado;
    if (nuevo === 'ENTREGADO') {
      const ok = await confirmar('Confirmar entrega', `¿Confirma que el pedido ${b.dataset.codigo} fue entregado al cliente?`, 'Sí, entregado');
      if (!ok) return;
    }
    try {
      await conCarga(b, () => cambiarEstado(b.dataset.id, nuevo));
      toast(`${b.dataset.codigo}: ${ESTADOS[nuevo]}`, 'exito');
      cargar();
    } catch (err) { mostrarError(err); }
    return;
  }
  const u = e.target.closest('[data-ubicacion]');
  if (u) {
    try {
      const pos = await conCarga(u, () => obtenerUbicacionNavegador());
      await registrarUbicacion(u.dataset.ubicacion, pos.lat, pos.lng);
      toast(`Ubicación registrada${pos.simulada ? ' (simulada)' : ''}`, 'exito');
    } catch (err) { mostrarError(err); }
  }
});

$('#ver-finalizados').addEventListener('change', cargar);
cargar();
