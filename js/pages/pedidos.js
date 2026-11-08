import { iniciarPagina } from '../layout.js';
import { listarPedidos, resumenEstados, listarRepartidores, eliminarPedido } from '../api.js';
import { ESTADOS, CONFIG } from '../config.js';
import { $, esc, badgeEstado, formatoFecha, toast, confirmar, mostrarError } from '../ui.js';
import { R, validarFormulario } from '../validaciones.js';

iniciarPagina({ roles: ['ADMINISTRADOR', 'OPERADOR'], activo: 'pedidos' });

const form = $('#form-filtros');
const cuerpo = $('#tabla-pedidos');
let filtros = { pagina: 1 };

$('#estado').insertAdjacentHTML('beforeend', Object.entries(ESTADOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join(''));
listarRepartidores().then(reps => {
  $('#repartidorId').insertAdjacentHTML('beforeend', reps.map(r => `<option value="${r.id}">${esc(r.nombre)}</option>`).join(''));
}).catch(mostrarError);

async function cargarKpis() {
  const conteo = await resumenEstados();
  $('#kpis').innerHTML = Object.entries(ESTADOS).map(([k, v]) =>
    `<button type="button" class="kpi ${k}" data-estado="${k}" style="text-align:left;cursor:pointer;font:inherit" title="Filtrar por ${v}">
       <b>${conteo[k]}</b><span>${v}</span></button>`).join('');
}

async function cargarTabla() {
  cuerpo.innerHTML = '<tr><td colspan="7" class="cargando">Cargando pedidos…</td></tr>';
  try {
    const r = await listarPedidos(filtros);
    if (!r.datos.length) {
      cuerpo.innerHTML = '<tr><td colspan="7" class="vacio">No hay pedidos que coincidan con los filtros.</td></tr>';
    } else {
      cuerpo.innerHTML = r.datos.map(p => {
        const editable = !['ENTREGADO', 'CANCELADO'].includes(p.estado);
        const eliminable = ['PENDIENTE', 'CANCELADO'].includes(p.estado);
        return `<tr>
          <td data-label="Código"><a href="pedido-detalle.html?id=${p.id}"><b>${p.codigo}</b></a></td>
          <td data-label="Cliente">${esc(p.cliente?.nombre)}</td>
          <td data-label="Destino">${esc(p.destino)}</td>
          <td data-label="Repartidor">${esc(p.repartidor?.nombre ?? '—')}</td>
          <td data-label="Estado">${badgeEstado(p.estado)}</td>
          <td data-label="Creado">${formatoFecha(p.fechaCreacion)}</td>
          <td data-label="Acciones">
            <a class="btn-link" href="pedido-detalle.html?id=${p.id}">Ver</a>
            ${editable ? `<a class="btn-link" href="pedido-form.html?id=${p.id}">Editar</a>` : ''}
            ${eliminable ? `<button class="btn-link peligro" data-eliminar="${p.id}" data-codigo="${p.codigo}">Eliminar</button>` : ''}
          </td></tr>`;
      }).join('');
    }
    const desde = r.total ? (r.pagina - 1) * CONFIG.POR_PAGINA + 1 : 0;
    $('#paginacion').innerHTML = `
      <span class="texto-suave">Mostrando ${desde}–${desde + r.datos.length - (r.total ? 1 : 0)} de ${r.total} pedidos</span>
      <div class="acciones">
        <button class="btn btn-sec btn-chico" data-pag="${r.pagina - 1}" ${r.pagina <= 1 ? 'disabled' : ''}>‹ Anterior</button>
        <span class="texto-suave" style="align-self:center">Página ${r.pagina} de ${r.paginas}</span>
        <button class="btn btn-sec btn-chico" data-pag="${r.pagina + 1}" ${r.pagina >= r.paginas ? 'disabled' : ''}>Siguiente ›</button>
      </div>`;
  } catch (e) {
    mostrarError(e);
    cuerpo.innerHTML = '<tr><td colspan="7" class="vacio">No se pudieron cargar los pedidos.</td></tr>';
  }
}

const esquemaFiltros = { hasta: [R.fechaNoMenorQue('desde', 'Debe ser igual o posterior a la fecha "Desde"')] };
form.setAttribute('novalidate', '');
form.addEventListener('submit', e => {
  e.preventDefault();
  if (!validarFormulario(form, esquemaFiltros)) return;
  filtros = { ...Object.fromEntries(new FormData(form)), pagina: 1 };
  cargarTabla();
});
form.addEventListener('reset', () => {
  setTimeout(() => { validarFormulario(form, esquemaFiltros); filtros = { pagina: 1 }; cargarTabla(); });
});
let espera;
$('#texto').addEventListener('input', () => { clearTimeout(espera); espera = setTimeout(() => form.requestSubmit(), 350); });
$('#estado').addEventListener('change', () => form.requestSubmit());
$('#repartidorId').addEventListener('change', () => form.requestSubmit());

$('#kpis').addEventListener('click', e => {
  const k = e.target.closest('[data-estado]');
  if (!k) return;
  $('#estado').value = k.dataset.estado;
  form.requestSubmit();
});

$('#paginacion').addEventListener('click', e => {
  const b = e.target.closest('[data-pag]');
  if (!b || b.disabled) return;
  filtros.pagina = Number(b.dataset.pag);
  cargarTabla();
});

cuerpo.addEventListener('click', async e => {
  const b = e.target.closest('[data-eliminar]');
  if (!b) return;
  const ok = await confirmar('Eliminar pedido', `¿Seguro que desea eliminar el pedido ${b.dataset.codigo}? Esta acción no se puede deshacer.`, 'Eliminar', true);
  if (!ok) return;
  try {
    await eliminarPedido(b.dataset.eliminar);
    toast(`Pedido ${b.dataset.codigo} eliminado`, 'exito');
    cargarKpis(); cargarTabla();
  } catch (err) { mostrarError(err); }
});

cargarKpis().catch(mostrarError);
cargarTabla();
