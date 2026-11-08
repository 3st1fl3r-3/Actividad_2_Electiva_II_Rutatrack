import { iniciarPagina } from '../layout.js';
import { listarRepartidores, crearRepartidor, actualizarRepartidor, eliminarRepartidor } from '../api.js';
import { $, esc, toast, confirmar, mostrarError, conCarga } from '../ui.js';
import { R, conectarValidacion, marcarError } from '../validaciones.js';

iniciarPagina({ roles: ['ADMINISTRADOR', 'OPERADOR'], activo: 'repartidores' });

const form = $('#form-repartidor');
const cuerpo = $('#tabla-repartidores');
let repartidores = [];

async function cargar() {
  try {
    repartidores = await listarRepartidores();
    cuerpo.innerHTML = repartidores.length ? repartidores.map(r => `
      <tr>
        <td data-label="Nombre"><b>${esc(r.nombre)}</b></td>
        <td data-label="Documento">${esc(r.documento)}</td>
        <td data-label="Teléfono">${esc(r.telefono)}</td>
        <td data-label="Vehículo">${esc(r.vehiculo)}${r.placa ? ` · ${esc(r.placa)}` : ''}</td>
        <td data-label="Activos / Capacidad">${r.activos} / ${r.capacidadMax}</td>
        <td data-label="Estado">${!r.disponible ? '<span class="badge lleno">No disponible</span>'
          : r.conCapacidad ? '<span class="badge ok">Disponible</span>' : '<span class="badge lleno">Sin capacidad</span>'}</td>
        <td data-label="Acciones">
          <button class="btn-link" data-editar="${r.id}">Editar</button>
          <button class="btn-link peligro" data-eliminar="${r.id}">Eliminar</button>
        </td>
      </tr>`).join('') : '<tr><td colspan="7" class="vacio">No hay repartidores registrados.</td></tr>';
  } catch (e) { mostrarError(e); }
}

function modoNuevo() {
  form.reset();
  form.elements.id.value = '';
  $('#titulo-form').textContent = 'Nuevo repartidor';
  $('#caja-password').classList.remove('oculto');
  limpiarErrores();
}

function limpiarErrores() {
  form.querySelectorAll('.campo').forEach(c => { c.classList.remove('invalido'); const e = c.querySelector('.error'); if (e) e.textContent = ''; });
}

function modoEditar(r) {
  limpiarErrores();
  $('#titulo-form').textContent = `Editar: ${r.nombre}`;
  for (const k of ['id', 'nombre', 'documento', 'telefono', 'vehiculo', 'placa', 'capacidadMax', 'email']) form.elements[k].value = r[k] ?? '';
  form.elements.disponible.value = String(r.disponible);
  form.elements.password.value = '';
  $('#caja-password').classList.add('oculto');
  form.elements.nombre.focus();
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const esNuevo = () => !form.elements.id.value;
const soloSiNuevo = regla => (v, f) => (esNuevo() ? regla(v, f) : '');

for (const campo of ['documento', 'telefono']) {
  form.elements[campo].addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, ''); });
}

conectarValidacion(form, {
  nombre: [R.requerido('El nombre es obligatorio'), R.soloLetras(), R.minLong(3)],
  documento: [R.requerido('El documento es obligatorio'), R.documento()],
  telefono: [R.requerido('El teléfono es obligatorio'), R.telefono()],
  vehiculo: [R.requerido('Seleccione el tipo de vehículo')],
  placa: [(v, f) => (f.elements.vehiculo.value && f.elements.vehiculo.value !== 'Bicicleta' && !v ? 'La placa es obligatoria para este vehículo' : ''), R.placa()],
  capacidadMax: [R.requerido('Indique la capacidad'), R.entero(1, 10)],
  email: [R.requerido('El correo es obligatorio'), R.email()],
  password: [soloSiNuevo(R.requerido('Defina una contraseña inicial')), soloSiNuevo(R.password())],
}, async (datos, boton) => {
  try {
    if (esNuevo()) {
      const r = await conCarga(boton, () => crearRepartidor(datos));
      toast(`Repartidor ${r.nombre} registrado`, 'exito');
    } else {
      const r = await conCarga(boton, () => actualizarRepartidor(datos.id, datos));
      toast(`Datos de ${r.nombre} actualizados`, 'exito');
    }
    modoNuevo();
    cargar();
  } catch (e) {
    if (e.campo) marcarError(form, e.campo, e.message); else mostrarError(e);
  }
});

form.addEventListener('reset', () => setTimeout(modoNuevo));
$('#btn-nuevo').addEventListener('click', () => { modoNuevo(); form.elements.nombre.focus(); });

cuerpo.addEventListener('click', async e => {
  const ed = e.target.closest('[data-editar]');
  if (ed) return modoEditar(repartidores.find(r => r.id === Number(ed.dataset.editar)));
  const el = e.target.closest('[data-eliminar]');
  if (!el) return;
  const r = repartidores.find(x => x.id === Number(el.dataset.eliminar));
  const ok = await confirmar('Eliminar repartidor', `¿Eliminar a ${r.nombre}? Su usuario quedará desactivado.`, 'Eliminar', true);
  if (!ok) return;
  try {
    await eliminarRepartidor(r.id);
    toast(`${r.nombre} eliminado`, 'exito');
    if (form.elements.id.value === String(r.id)) modoNuevo();
    cargar();
  } catch (err) { mostrarError(err); }
});

cargar();
