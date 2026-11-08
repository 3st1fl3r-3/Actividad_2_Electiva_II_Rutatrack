import { iniciarPagina } from '../layout.js';
import { listarUsuarios, registrarUsuario, cambiarActivo } from '../api.js';
import { ROLES } from '../config.js';
import { $, esc, toast, mostrarError, conCarga } from '../ui.js';
import { R, conectarValidacion, marcarError } from '../validaciones.js';

const yo = iniciarPagina({ roles: ['ADMINISTRADOR'], activo: 'usuarios' });
const form = $('#form-usuario');
const cuerpo = $('#tabla-usuarios');

async function cargar() {
  try {
    const usuarios = await listarUsuarios();
    cuerpo.innerHTML = usuarios.map(u => `
      <tr>
        <td data-label="Nombre"><b>${esc(u.nombre)}</b></td>
        <td data-label="Correo">${esc(u.email)}</td>
        <td data-label="Rol">${ROLES[u.rol]}</td>
        <td data-label="Estado">${u.activo ? '<span class="badge ok">Activo</span>' : '<span class="badge lleno">Inactivo</span>'}</td>
        <td data-label="Acciones">${u.id === yo.id ? '<span class="texto-suave">(usted)</span>'
          : `<button class="btn-link ${u.activo ? 'peligro' : ''}" data-activo="${u.id}">${u.activo ? 'Desactivar' : 'Activar'}</button>`}</td>
      </tr>`).join('');
  } catch (e) { mostrarError(e); }
}

conectarValidacion(form, {
  nombre: [R.requerido('El nombre es obligatorio'), R.soloLetras(), R.minLong(3)],
  email: [R.requerido('El correo es obligatorio'), R.email()],
  rol: [R.requerido('Seleccione un rol')],
  password: [R.requerido('Defina una contraseña'), R.password()],
  confirmar: [R.requerido('Confirme la contraseña'), R.igualA('password', 'Las contraseñas no coinciden')],
}, async (datos, boton) => {
  try {
    const u = await conCarga(boton, () => registrarUsuario(datos));
    toast(`Usuario ${u.nombre} registrado como ${ROLES[u.rol]}`, 'exito');
    form.reset();
    cargar();
  } catch (e) {
    if (e.campo) marcarError(form, e.campo, e.message); else mostrarError(e);
  }
});

cuerpo.addEventListener('click', async e => {
  const b = e.target.closest('[data-activo]');
  if (!b) return;
  try {
    const r = await cambiarActivo(b.dataset.activo);
    toast(r.activo ? 'Usuario activado' : 'Usuario desactivado', 'exito');
    cargar();
  } catch (err) { mostrarError(err); }
});

cargar();
