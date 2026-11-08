import { login } from '../api.js';
import { guardarSesion, obtenerSesion, inicioSegunRol } from '../sesion.js';
import { R, conectarValidacion } from '../validaciones.js';
import { $, conCarga, parametroURL } from '../ui.js';

const actual = obtenerSesion();
if (actual?.token) location.replace(inicioSegunRol(actual.usuario.rol));

const form = $('#form-login');
const aviso = $('#aviso');

conectarValidacion(form, {
  email: [R.requerido('Ingrese su correo'), R.email()],
  password: [R.requerido('Ingrese su contraseña'), R.minLong(6)],
}, async (datos, boton) => {
  aviso.classList.add('oculto');
  try {
    const sesion = await conCarga(boton, () => login(datos.email, datos.password));
    guardarSesion(sesion);
    const volver = parametroURL('volver');
    location.href = volver && !volver.startsWith('login') ? volver : inicioSegunRol(sesion.usuario.rol);
  } catch (e) {
    aviso.textContent = e.message;
    aviso.classList.remove('oculto');
    form.elements.password.value = '';
    form.elements.password.focus();
  }
});

document.querySelectorAll('[data-email]').forEach(b => b.addEventListener('click', () => {
  form.elements.email.value = b.dataset.email;
  form.elements.password.value = b.dataset.pass;
  form.requestSubmit();
}));
