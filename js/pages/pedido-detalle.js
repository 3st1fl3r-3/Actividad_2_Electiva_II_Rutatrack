import { iniciarPagina } from '../layout.js';
import {
  obtenerPedido, historialPedido, cambiarEstado, asignarRepartidor, listarRepartidores,
  ultimaUbicacion, estadosPermitidos, registrarUbicacion,
} from '../api.js';
import { ESTADOS } from '../config.js';
import { $, esc, badgeEstado, formatoFecha, toast, confirmar, mostrarError, conCarga, parametroURL } from '../ui.js';
import { pintarMapa, distanciaKm } from '../mapa.js';
import { obtenerUbicacionNavegador } from '../geolocalizacion.js';

const usuario = iniciarPagina({ activo: 'pedidos' });
const esRepartidor = usuario.rol === 'REPARTIDOR';
const id = parametroURL('id');
const zona = $('#contenido-detalle');

if (esRepartidor) $('#btn-volver').href = 'mis-entregas.html';

const TEXTO_EVENTO = {
  CREACION: () => 'Pedido creado (Pendiente)',
  CAMBIO_ESTADO: e => `Cambio de estado: ${ESTADOS[e.estadoAnterior] ?? '—'} → ${ESTADOS[e.estadoNuevo]}`,
  ASIGNACION: e => e.descripcion,
  REASIGNACION: e => e.descripcion,
  UBICACION: e => e.descripcion,
};

async function cargar() {
  if (!id) { zona.innerHTML = '<div class="aviso error">No se indicó el pedido.</div>'; return; }
  try {
    const [p, eventos] = await Promise.all([obtenerPedido(id), historialPedido(id)]);
    const ubic = p.repartidorId ? await ultimaUbicacion(p.repartidorId) : null;
    pintar(p, eventos, ubic);
  } catch (e) {
    zona.className = '';
    zona.innerHTML = `<div class="aviso error">${esc(e.message)}</div>`;
  }
}

function pintar(p, eventos, ubic) {
  document.title = `${p.codigo} · RutaTrack`;
  $('#titulo').innerHTML = `Pedido ${p.codigo} ${badgeEstado(p.estado)}`;
  $('#subtitulo').textContent = `Cliente: ${p.cliente?.nombre ?? '—'} · Repartidor: ${p.repartidor?.nombre ?? 'sin asignar'}`;
  const editar = $('#btn-editar');
  editar.href = `pedido-form.html?id=${p.id}`;
  editar.classList.toggle('oculto', esRepartidor || ['ENTREGADO', 'CANCELADO'].includes(p.estado));

  const opcionesEstado = estadosPermitidos(p, usuario.rol);
  const puedeAsignar = !esRepartidor && ['PENDIENTE', 'ASIGNADO'].includes(p.estado);
  const distancia = ubic ? distanciaKm(ubic, p).toFixed(1).replace('.', ',') : null;

  zona.className = 'detalle-grid';
  zona.innerHTML = `
    <div>
      <section class="tarjeta">
        <h2>Datos del pedido</h2>
        <dl class="datos">
          <dt>Origen</dt><dd>${esc(p.origen)}</dd>
          <dt>Destino</dt><dd>${esc(p.destino)}</dd>
          <dt>Descripción</dt><dd>${esc(p.descripcion)}</dd>
          <dt>Teléfono</dt><dd>${esc(p.telefonoContacto)}</dd>
          <dt>Creado</dt><dd>${formatoFecha(p.fechaCreacion)}</dd>
          <dt>Actualizado</dt><dd>${formatoFecha(p.fechaActualizacion)}</dd>
        </dl>
      </section>

      <section class="tarjeta">
        <h2>Acciones</h2>
        ${opcionesEstado.length ? `
          <form id="form-estado" class="form-grid" style="align-items:end">
            <div class="campo">
              <label for="nuevoEstado">Cambiar estado</label>
              <select id="nuevoEstado" name="nuevoEstado">
                ${opcionesEstado.map(e => `<option value="${e}">${ESTADOS[e]}</option>`).join('')}
              </select>
            </div>
            <div><button class="btn" type="submit">Actualizar estado</button></div>
          </form>` : `<p class="texto-suave">${['ENTREGADO', 'CANCELADO'].includes(p.estado) ? 'El pedido finalizó; no admite más cambios de estado.' : 'Asigne un repartidor para avanzar el pedido.'}</p>`}
        ${puedeAsignar ? `
          <form id="form-asignar" class="form-grid" style="align-items:end;margin-top:14px">
            <div class="campo">
              <label for="repartidor">${p.repartidorId ? 'Reasignar a' : 'Asignar a'}</label>
              <select id="repartidor" name="repartidor"><option value="">Cargando…</option></select>
              <div class="error"></div>
            </div>
            <div><button class="btn btn-sec" type="submit">${p.repartidorId ? 'Reasignar' : 'Asignar'}</button></div>
          </form>` : ''}
        ${esRepartidor && p.estado === 'EN_TRANSITO' ? `
          <button class="btn btn-sec" id="btn-ubicacion" style="margin-top:14px">📍 Registrar mi ubicación</button>` : ''}
      </section>

      <section class="tarjeta">
        <h2>Ubicación</h2>
        <p class="texto-suave">${ubic
          ? `Última ubicación del repartidor: ${formatoFecha(ubic.fechaHora)} · distancia aprox. al destino: <b>${distancia} km</b>`
          : 'Aún no hay ubicaciones reportadas. Se muestra el destino.'}</p>
        <div id="mapa"></div>
      </section>
    </div>

    <section class="tarjeta">
      <h2>Línea de tiempo</h2>
      <ul class="timeline">
        ${eventos.map(e => `<li class="${e.tipo}"><b>${esc(TEXTO_EVENTO[e.tipo](e))}</b>
          <small>${formatoFecha(e.fechaHora)} · ${esc(e.usuario)}</small></li>`).join('')}
      </ul>
    </section>`;

  pintarMapa($('#mapa'), { lat: p.lat, lng: p.lng, texto: p.destino }, ubic);

  $('#form-estado')?.addEventListener('submit', async e => {
    e.preventDefault();
    const nuevo = e.target.elements.nuevoEstado.value;
    const ok = await confirmar('Cambiar estado', `El pedido ${p.codigo} pasará de ${ESTADOS[p.estado]} a ${ESTADOS[nuevo]}.`, 'Confirmar', nuevo === 'CANCELADO');
    if (!ok) return;
    try {
      await conCarga(e.submitter, () => cambiarEstado(p.id, nuevo));
      toast(`Estado actualizado a ${ESTADOS[nuevo]}`, 'exito');
      cargar();
    } catch (err) { mostrarError(err); }
  });

  if (puedeAsignar) prepararAsignacion(p);

  $('#btn-ubicacion')?.addEventListener('click', async e => {
    try {
      const pos = await conCarga(e.currentTarget, () => obtenerUbicacionNavegador());
      await registrarUbicacion(p.id, pos.lat, pos.lng);
      toast('Ubicación registrada', 'exito');
      cargar();
    } catch (err) { mostrarError(err); }
  });
}

async function prepararAsignacion(p) {
  const form = $('#form-asignar');
  const select = form.elements.repartidor;
  const reps = (await listarRepartidores()).filter(r => r.id !== p.repartidorId);
  select.innerHTML = '<option value="">Seleccione…</option>' + reps.map(r =>
    `<option value="${r.id}" ${r.conCapacidad ? '' : 'disabled'}>${esc(r.nombre)} — ${r.activos}/${r.capacidadMax}${r.conCapacidad ? '' : ' (sin capacidad)'}</option>`).join('');
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const caja = select.closest('.campo');
    if (!select.value) {
      caja.classList.add('invalido');
      caja.querySelector('.error').textContent = 'Seleccione un repartidor';
      return;
    }
    caja.classList.remove('invalido');
    caja.querySelector('.error').textContent = '';
    try {
      await conCarga(e.submitter, () => asignarRepartidor(p.id, select.value));
      toast('Repartidor asignado', 'exito');
      cargar();
    } catch (err) { mostrarError(err); }
  });
}

cargar();
