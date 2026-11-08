import { iniciarPagina } from '../layout.js';
import { listarClientes, listarRepartidores, obtenerPedido, crearPedido, actualizarPedido } from '../api.js';
import { ESTADOS } from '../config.js';
import { $, esc, toast, mostrarError, conCarga, parametroURL } from '../ui.js';
import { R, conectarValidacion } from '../validaciones.js';

iniciarPagina({ roles: ['ADMINISTRADOR', 'OPERADOR'], activo: 'pedidos' });

const form = $('#form-pedido');
const id = parametroURL('id');
let clientes = [];

async function cargar() {
  const [cls, reps, pedido] = await Promise.all([listarClientes(), listarRepartidores(), id ? obtenerPedido(id) : null]);
  clientes = cls;
  $('#clienteId').insertAdjacentHTML('beforeend', cls.map(c => `<option value="${c.id}">${esc(c.nombre)}</option>`).join(''));

  const opciones = reps.filter(r => r.conCapacidad || r.id === pedido?.repartidorId);
  $('#repartidorId').insertAdjacentHTML('beforeend', opciones.map(r =>
    `<option value="${r.id}">${esc(r.nombre)} — ${r.activos}/${r.capacidadMax} pedidos</option>`).join(''));

  if (pedido) {
    if (['ENTREGADO', 'CANCELADO'].includes(pedido.estado)) {
      toast('Este pedido ya finalizó y no se puede editar', 'error');
      location.replace(`pedido-detalle.html?id=${pedido.id}`);
      return;
    }
    document.title = `Editar ${pedido.codigo} · RutaTrack`;
    $('#titulo').textContent = `Editar pedido ${pedido.codigo}`;
    for (const campo of ['clienteId', 'telefonoContacto', 'origen', 'destino', 'descripcion', 'repartidorId']) {
      form.elements[campo].value = pedido[campo] ?? '';
    }
    $('#estadoActual').value = ESTADOS[pedido.estado];
    if (pedido.estado === 'EN_TRANSITO') form.elements.repartidorId.disabled = true;
    actualizarContador();
  }
}

$('#clienteId').addEventListener('change', e => {
  const c = clientes.find(x => String(x.id) === e.target.value);
  const tel = form.elements.telefonoContacto;
  if (c && !tel.value && /^\d{10}$/.test(c.telefono)) tel.value = c.telefono;
});

$('#telefonoContacto').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, ''); });

function actualizarContador() {
  const n = form.elements.descripcion.value.length;
  $('#contador').textContent = n;
  $('#contador').style.color = n > 255 ? 'var(--error)' : '';
}
$('#descripcion').addEventListener('input', actualizarContador);

conectarValidacion(form, {
  clienteId: [R.requerido('Seleccione el cliente')],
  telefonoContacto: [R.requerido('El teléfono es obligatorio'), R.telefono()],
  origen: [R.requerido('La dirección de origen es obligatoria'), R.minLong(8)],
  destino: [R.requerido('La dirección de destino es obligatoria'), R.minLong(8)],
  descripcion: [R.requerido('Describa el contenido del pedido'), R.minLong(5), R.maxLong(255)],
}, async (datos, boton) => {
  try {
    const guardado = await conCarga(boton, () => (id ? actualizarPedido(id, datos) : crearPedido(datos)));
    toast(id ? `Pedido ${guardado.codigo} actualizado` : `Pedido ${guardado.codigo} creado`, 'exito');
    setTimeout(() => { location.href = `pedido-detalle.html?id=${guardado.id}`; }, 600);
  } catch (e) { mostrarError(e); }
});

cargar().catch(e => { mostrarError(e); });
