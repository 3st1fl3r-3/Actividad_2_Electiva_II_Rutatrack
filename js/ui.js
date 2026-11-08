import { ESTADOS } from './config.js';

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

export function esc(texto) {
  return String(texto ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function badgeEstado(estado) {
  return `<span class="badge ${estado}">${ESTADOS[estado] ?? estado}</span>`;
}

export function formatoFecha(iso, conHora = true) {
  if (!iso) return '—';
  const f = new Date(iso);
  const opciones = { day: '2-digit', month: '2-digit', year: 'numeric' };
  if (conHora) Object.assign(opciones, { hour: '2-digit', minute: '2-digit', hour12: false });
  return f.toLocaleString('es-CO', opciones);
}

export function toast(mensaje, tipo = '') {
  let cont = $('#toasts');
  if (!cont) { cont = document.createElement('div'); cont.id = 'toasts'; document.body.append(cont); }
  const t = document.createElement('div');
  t.className = `toast ${tipo}`;
  t.setAttribute('role', 'status');
  t.textContent = mensaje;
  cont.append(t);
  setTimeout(() => t.remove(), 3500);
}

export function confirmar(titulo, mensaje, textoBoton = 'Confirmar', peligro = false) {
  return new Promise(resolver => {
    const fondo = document.createElement('div');
    fondo.className = 'modal-fondo';
    fondo.innerHTML = `
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">
        <h2 id="modal-titulo">${esc(titulo)}</h2>
        <p>${esc(mensaje)}</p>
        <div class="form-acciones">
          <button class="btn btn-sec" data-r="0">Cancelar</button>
          <button class="btn ${peligro ? 'btn-peligro' : ''}" data-r="1">${esc(textoBoton)}</button>
        </div>
      </div>`;
    const cerrar = r => { fondo.remove(); document.removeEventListener('keydown', tecla); resolver(r); };
    const tecla = e => { if (e.key === 'Escape') cerrar(false); };
    fondo.addEventListener('click', e => {
      if (e.target === fondo) cerrar(false);
      const b = e.target.closest('[data-r]');
      if (b) cerrar(b.dataset.r === '1');
    });
    document.addEventListener('keydown', tecla);
    document.body.append(fondo);
    fondo.querySelector('[data-r="1"]').focus();
  });
}

export function mostrarError(error) {
  console.warn(error);
  toast(error?.message || 'Ocurrió un error inesperado', 'error');
}

export async function conCarga(boton, accion) {
  const texto = boton.textContent;
  boton.disabled = true;
  boton.textContent = 'Procesando…';
  try { return await accion(); } finally { boton.disabled = false; boton.textContent = texto; }
}

export function parametroURL(nombre) {
  return new URLSearchParams(location.search).get(nombre);
}
