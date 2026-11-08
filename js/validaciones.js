export const R = {
  requerido: (msg = 'Este campo es obligatorio') => v => (String(v).trim() === '' ? msg : ''),
  email: () => v => (v && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v.trim()) ? 'Ingrese un correo válido (ej. nombre@dominio.com)' : ''),
  telefono: () => v => (v && !/^\d{10}$/.test(v.trim()) ? 'El teléfono debe tener 10 dígitos numéricos' : ''),
  documento: () => v => (v && !/^\d{6,10}$/.test(v.trim()) ? 'El documento debe tener entre 6 y 10 dígitos, sin puntos' : ''),
  placa: () => v => (v && !/^[A-Z]{3}-\d{2}[A-Z0-9]$/i.test(v.trim()) ? 'Formato de placa inválido (ej. ABC-123 o ABC-12D)' : ''),
  minLong: n => v => (v && v.trim().length < n ? `Debe tener al menos ${n} caracteres` : ''),
  maxLong: n => v => (v && v.length > n ? `Máximo ${n} caracteres (lleva ${v.length})` : ''),
  entero: (min, max) => v => {
    if (v === '') return '';
    const n = Number(v);
    return !Number.isInteger(n) || n < min || n > max ? `Debe ser un número entero entre ${min} y ${max}` : '';
  },
  soloLetras: () => v => (v && !/^[A-Za-zÁÉÍÓÚáéíóúÑñÜü .'-]+$/.test(v.trim()) ? 'Solo se permiten letras y espacios' : ''),
  password: () => v => (v && !/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(v) ? 'Mínimo 8 caracteres, con letras y números' : ''),
  igualA: (campo, msg) => (v, form) => (v !== form.elements[campo].value ? msg : ''),
  codigoSeguimiento: () => v => (v && !/^PED-\d{5}$/i.test(v.trim()) ? 'El código tiene el formato PED-00000' : ''),
  fechaNoMenorQue: (campo, msg) => (v, form) => {
    const otra = form.elements[campo].value;
    return v && otra && v < otra ? msg : '';
  },
};

function contenedor(input) { return input.closest('.campo'); }

export function validarCampo(form, nombre, reglas) {
  const input = form.elements[nombre];
  if (!input) return true;
  let mensaje = '';
  for (const regla of reglas) {
    mensaje = regla(input.value, form);
    if (mensaje) break;
  }
  const caja = contenedor(input);
  const error = caja?.querySelector('.error');
  caja?.classList.toggle('invalido', !!mensaje);
  input.setAttribute('aria-invalid', mensaje ? 'true' : 'false');
  if (error) error.textContent = mensaje;
  return !mensaje;
}

export function validarFormulario(form, esquema) {
  let valido = true, primero = null;
  for (const [nombre, reglas] of Object.entries(esquema)) {
    const ok = validarCampo(form, nombre, reglas);
    if (!ok && !primero) primero = form.elements[nombre];
    valido = valido && ok;
  }
  primero?.focus();
  return valido;
}

export function conectarValidacion(form, esquema, alEnviar) {
  let intentado = false;
  form.setAttribute('novalidate', '');
  for (const nombre of Object.keys(esquema)) {
    const input = form.elements[nombre];
    if (!input) continue;
    input.addEventListener('blur', () => { if (input.value !== '' || intentado) validarCampo(form, nombre, esquema[nombre]); });
    input.addEventListener('input', () => { if (intentado || contenedor(input)?.classList.contains('invalido')) validarCampo(form, nombre, esquema[nombre]); });
  }
  form.addEventListener('submit', async e => {
    e.preventDefault();
    intentado = true;
    if (!validarFormulario(form, esquema)) return;
    const datos = Object.fromEntries(new FormData(form).entries());
    for (const k in datos) if (typeof datos[k] === 'string') datos[k] = datos[k].trim();
    await alEnviar(datos, form.querySelector('[type="submit"]'));
  });
}

export function marcarError(form, nombre, mensaje) {
  const input = form.elements[nombre];
  const caja = input?.closest('.campo');
  if (!caja) return;
  caja.classList.add('invalido');
  caja.querySelector('.error').textContent = mensaje;
  input.focus();
}
