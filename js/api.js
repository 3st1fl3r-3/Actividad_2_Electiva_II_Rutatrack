import { CONFIG, TRANSICIONES, ESTADOS } from './config.js';
import { obtenerSesion } from './sesion.js';

const CLAVE_BD = 'rutatrack_bd_v1';
const ARCHIVOS = ['usuarios', 'clientes', 'repartidores', 'pedidos', 'eventos', 'ubicaciones'];
const ACTIVOS = ['ASIGNADO', 'EN_TRANSITO'];

export class ApiError extends Error {
  constructor(status, mensaje) { super(mensaje); this.status = status; }
}

let bd = null;

function leerLocal() {
  try { const s = localStorage.getItem(CLAVE_BD); return s ? JSON.parse(s) : null; } catch { return null; }
}
function guardar() {
  try { localStorage.setItem(CLAVE_BD, JSON.stringify(bd)); } catch {}
}

async function cargarBD() {
  if (bd) return bd;
  bd = leerLocal();
  if (bd) return bd;
  const datos = await Promise.all(ARCHIVOS.map(async nombre => {
    const r = await fetch(`data/${nombre}.json`);
    if (!r.ok) throw new ApiError(500, `No se pudo cargar data/${nombre}.json`);
    return r.json();
  }));
  bd = Object.fromEntries(ARCHIVOS.map((n, i) => [n, datos[i]]));
  guardar();
  return bd;
}

async function responder(valor) {
  await new Promise(r => setTimeout(r, CONFIG.LATENCIA_MS));
  return valor === undefined ? undefined : structuredClone(valor);
}

const ahora = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
};
const sigId = lista => lista.reduce((m, x) => Math.max(m, x.id), 0) + 1;

function exigirRol(...roles) {
  const s = obtenerSesion();
  if (!s?.token) throw new ApiError(401, 'Su sesión expiró. Inicie sesión nuevamente.');
  if (roles.length && !roles.includes(s.usuario.rol)) throw new ApiError(403, 'No tiene permiso para realizar esta acción.');
  return s.usuario;
}

function buscar(lista, id, nombre) {
  const x = lista.find(e => e.id === Number(id));
  if (!x) throw new ApiError(404, `${nombre} no encontrado.`);
  return x;
}

function registrarEvento(pedidoId, tipo, descripcion, usuarioId, estadoAnterior = null, estadoNuevo = null) {
  bd.eventos.push({ id: sigId(bd.eventos), pedidoId, tipo, estadoAnterior, estadoNuevo, descripcion, usuarioId, fechaHora: ahora() });
}

const pedidosActivos = repId => bd.pedidos.filter(p => p.repartidorId === repId && ACTIVOS.includes(p.estado)).length;

function repartidorConCarga(r) {
  const activos = pedidosActivos(r.id);
  const usuario = bd.usuarios.find(u => u.id === r.usuarioId);
  return { ...r, email: usuario?.email ?? '', activos, conCapacidad: r.disponible && activos < r.capacidadMax };
}

function enriquecerPedido(p) {
  return {
    ...p,
    cliente: bd.clientes.find(c => c.id === p.clienteId) ?? null,
    repartidor: bd.repartidores.find(r => r.id === p.repartidorId) ?? null,
  };
}

function verificarAcceso(usuario, pedido) {
  if (usuario.rol !== 'REPARTIDOR') return;
  const rep = bd.repartidores.find(r => r.usuarioId === usuario.id);
  if (!rep || pedido.repartidorId !== rep.id) throw new ApiError(403, 'Este pedido no está asignado a usted.');
}

export async function login(email, password) {
  await cargarBD();
  const u = bd.usuarios.find(x => x.email.toLowerCase() === email.toLowerCase());
  if (!u || u.password !== password || !u.activo) {
    await responder();
    throw new ApiError(401, 'Correo o contraseña incorrectos.');
  }
  const usuario = { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol };
  const token = btoa(JSON.stringify({ sub: u.id, rol: u.rol, exp: Date.now() + 8 * 3600e3 }));
  return responder({ token, usuario });
}

export async function listarPedidos(filtros = {}) {
  await cargarBD();
  exigirRol('ADMINISTRADOR', 'OPERADOR');
  const { texto = '', estado = '', repartidorId = '', desde = '', hasta = '', pagina = 1 } = filtros;
  const t = texto.toLowerCase();
  let lista = bd.pedidos.map(enriquecerPedido).filter(p =>
    (!estado || p.estado === estado) &&
    (!repartidorId || String(p.repartidorId) === String(repartidorId)) &&
    (!desde || p.fechaCreacion.slice(0, 10) >= desde) &&
    (!hasta || p.fechaCreacion.slice(0, 10) <= hasta) &&
    (!t || p.codigo.toLowerCase().includes(t) || p.cliente?.nombre.toLowerCase().includes(t) || p.destino.toLowerCase().includes(t)));
  lista.sort((a, b) => b.fechaCreacion.localeCompare(a.fechaCreacion));
  const total = lista.length;
  const paginas = Math.max(1, Math.ceil(total / CONFIG.POR_PAGINA));
  const pag = Math.min(Math.max(1, Number(pagina)), paginas);
  lista = lista.slice((pag - 1) * CONFIG.POR_PAGINA, pag * CONFIG.POR_PAGINA);
  return responder({ datos: lista, total, pagina: pag, paginas });
}

export async function resumenEstados() {
  await cargarBD();
  exigirRol('ADMINISTRADOR', 'OPERADOR');
  const conteo = Object.fromEntries(Object.keys(ESTADOS).map(e => [e, 0]));
  bd.pedidos.forEach(p => conteo[p.estado]++);
  return responder(conteo);
}

export async function obtenerPedido(id) {
  await cargarBD();
  const u = exigirRol();
  const p = buscar(bd.pedidos, id, 'Pedido');
  verificarAcceso(u, p);
  return responder(enriquecerPedido(p));
}

export async function crearPedido(datos) {
  await cargarBD();
  const u = exigirRol('ADMINISTRADOR', 'OPERADOR');
  buscar(bd.clientes, datos.clienteId, 'Cliente');
  const id = sigId(bd.pedidos);
  const fecha = ahora();
  const pedido = {
    id,
    codigo: `PED-${String(100 + id).padStart(5, '0')}`,
    clienteId: Number(datos.clienteId),
    telefonoContacto: datos.telefonoContacto,
    descripcion: datos.descripcion,
    origen: datos.origen,
    destino: datos.destino,

    lat: +(4.60 + Math.random() * 0.12).toFixed(6),
    lng: +(-74.13 + Math.random() * 0.09).toFixed(6),
    estado: 'PENDIENTE',
    repartidorId: null,
    creadoPor: u.id,
    fechaCreacion: fecha,
    fechaActualizacion: fecha,
  };
  bd.pedidos.push(pedido);
  registrarEvento(id, 'CREACION', 'Pedido creado', u.id, null, 'PENDIENTE');
  if (datos.repartidorId) asignarInterno(pedido, Number(datos.repartidorId), u);
  guardar();
  return responder(enriquecerPedido(pedido));
}

export async function actualizarPedido(id, datos) {
  await cargarBD();
  const u = exigirRol('ADMINISTRADOR', 'OPERADOR');
  const p = buscar(bd.pedidos, id, 'Pedido');
  if (['ENTREGADO', 'CANCELADO'].includes(p.estado)) throw new ApiError(409, 'No se puede editar un pedido entregado o cancelado.');
  Object.assign(p, {
    clienteId: Number(datos.clienteId),
    telefonoContacto: datos.telefonoContacto,
    descripcion: datos.descripcion,
    origen: datos.origen,
    destino: datos.destino,
    fechaActualizacion: ahora(),
  });
  const nuevoRep = datos.repartidorId ? Number(datos.repartidorId) : null;
  if (nuevoRep && nuevoRep !== p.repartidorId) asignarInterno(p, nuevoRep, u);
  guardar();
  return responder(enriquecerPedido(p));
}

export async function eliminarPedido(id) {
  await cargarBD();
  exigirRol('ADMINISTRADOR', 'OPERADOR');
  const p = buscar(bd.pedidos, id, 'Pedido');
  if (!['PENDIENTE', 'CANCELADO'].includes(p.estado)) {
    throw new ApiError(409, `No se puede eliminar un pedido en estado ${ESTADOS[p.estado]}.`);
  }
  bd.pedidos = bd.pedidos.filter(x => x.id !== p.id);
  bd.eventos = bd.eventos.filter(e => e.pedidoId !== p.id);
  guardar();
  return responder({ ok: true });
}

export function estadosPermitidos(pedido, rol) {
  let opciones = TRANSICIONES[pedido.estado].filter(e => e !== 'ASIGNADO');
  if (rol === 'REPARTIDOR') opciones = opciones.filter(e => e !== 'CANCELADO');
  return opciones;
}

export async function cambiarEstado(id, nuevo) {
  await cargarBD();
  const u = exigirRol('ADMINISTRADOR', 'OPERADOR', 'REPARTIDOR');
  const p = buscar(bd.pedidos, id, 'Pedido');
  verificarAcceso(u, p);
  if (!estadosPermitidos(p, u.rol).includes(nuevo)) {
    throw new ApiError(409, `No se permite pasar de ${ESTADOS[p.estado]} a ${ESTADOS[nuevo] ?? nuevo}.`);
  }
  const anterior = p.estado;
  p.estado = nuevo;
  p.fechaActualizacion = ahora();
  const desc = nuevo === 'ENTREGADO' ? 'Pedido entregado' : nuevo === 'CANCELADO' ? 'Pedido cancelado' : 'Cambio de estado';
  registrarEvento(p.id, 'CAMBIO_ESTADO', desc, u.id, anterior, nuevo);
  guardar();
  return responder(enriquecerPedido(p));
}

function asignarInterno(p, repId, u) {
  if (!['PENDIENTE', 'ASIGNADO'].includes(p.estado)) throw new ApiError(409, 'Solo se pueden asignar pedidos Pendientes o Asignados.');
  const rep = buscar(bd.repartidores, repId, 'Repartidor');
  if (p.repartidorId === rep.id) throw new ApiError(409, 'El pedido ya está asignado a ese repartidor.');
  if (!rep.disponible) throw new ApiError(409, `${rep.nombre} no está disponible.`);
  if (pedidosActivos(rep.id) >= rep.capacidadMax) {
    throw new ApiError(409, `${rep.nombre} alcanzó su capacidad máxima (${rep.capacidadMax} pedidos activos).`);
  }
  const era = p.repartidorId;
  p.repartidorId = rep.id;
  p.fechaActualizacion = ahora();
  if (era) {
    const anterior = bd.repartidores.find(r => r.id === era);
    registrarEvento(p.id, 'REASIGNACION', `Reasignado de ${anterior?.nombre ?? '—'} a ${rep.nombre}`, u.id);
  } else {
    registrarEvento(p.id, 'ASIGNACION', `Asignado a ${rep.nombre}`, u.id);
    registrarEvento(p.id, 'CAMBIO_ESTADO', 'Cambio de estado', u.id, 'PENDIENTE', 'ASIGNADO');
    p.estado = 'ASIGNADO';
  }
}

export async function asignarRepartidor(id, repartidorId) {
  await cargarBD();
  const u = exigirRol('ADMINISTRADOR', 'OPERADOR');
  const p = buscar(bd.pedidos, id, 'Pedido');
  asignarInterno(p, Number(repartidorId), u);
  guardar();
  return responder(enriquecerPedido(p));
}

export async function historialPedido(id) {
  await cargarBD();
  const u = exigirRol();
  const p = buscar(bd.pedidos, id, 'Pedido');
  verificarAcceso(u, p);
  const eventos = bd.eventos
    .filter(e => e.pedidoId === p.id)
    .map(e => ({ ...e, usuario: bd.usuarios.find(x => x.id === e.usuarioId)?.nombre ?? '—' }))
    .sort((a, b) => b.fechaHora.localeCompare(a.fechaHora) || b.id - a.id);
  return responder(eventos);
}

export async function seguimientoPublico(codigo) {
  await cargarBD();
  const p = bd.pedidos.find(x => x.codigo.toUpperCase() === codigo.toUpperCase());
  if (!p) { await responder(); throw new ApiError(404, 'No se encontró un pedido con ese código.'); }
  const eventos = bd.eventos
    .filter(e => e.pedidoId === p.id && (e.tipo === 'CAMBIO_ESTADO' || e.tipo === 'CREACION'))
    .map(e => ({ estado: e.estadoNuevo, fechaHora: e.fechaHora }))
    .sort((a, b) => b.fechaHora.localeCompare(a.fechaHora));
  return responder({ codigo: p.codigo, estado: p.estado, destino: p.destino, fechaActualizacion: p.fechaActualizacion, eventos });
}

export async function listarRepartidores() {
  await cargarBD();
  exigirRol('ADMINISTRADOR', 'OPERADOR');
  return responder(bd.repartidores.map(repartidorConCarga).sort((a, b) => a.nombre.localeCompare(b.nombre)));
}

export async function crearRepartidor(datos) {
  await cargarBD();
  exigirRol('ADMINISTRADOR', 'OPERADOR');
  validarUnicos(datos);
  const usuario = { id: sigId(bd.usuarios), nombre: datos.nombre, email: datos.email, password: datos.password, rol: 'REPARTIDOR', activo: true };
  bd.usuarios.push(usuario);
  const rep = {
    id: sigId(bd.repartidores), usuarioId: usuario.id, nombre: datos.nombre, documento: datos.documento, telefono: datos.telefono,
    vehiculo: datos.vehiculo, placa: (datos.placa || '').toUpperCase(), capacidadMax: Number(datos.capacidadMax), disponible: datos.disponible !== 'false',
  };
  bd.repartidores.push(rep);
  guardar();
  return responder(repartidorConCarga(rep));
}

export async function actualizarRepartidor(id, datos) {
  await cargarBD();
  exigirRol('ADMINISTRADOR', 'OPERADOR');
  const rep = buscar(bd.repartidores, id, 'Repartidor');
  validarUnicos(datos, rep);
  const cap = Number(datos.capacidadMax);
  if (cap < pedidosActivos(rep.id)) throw new ApiError(409, `Tiene ${pedidosActivos(rep.id)} pedidos activos; la capacidad no puede ser menor.`);
  Object.assign(rep, {
    nombre: datos.nombre, documento: datos.documento, telefono: datos.telefono, vehiculo: datos.vehiculo,
    placa: (datos.placa || '').toUpperCase(), capacidadMax: cap, disponible: datos.disponible !== 'false',
  });
  const u = bd.usuarios.find(x => x.id === rep.usuarioId);
  if (u) { u.nombre = datos.nombre; u.email = datos.email; }
  guardar();
  return responder(repartidorConCarga(rep));
}

function validarUnicos(datos, actual = null) {
  if (bd.repartidores.some(r => r.documento === datos.documento && r.id !== actual?.id)) {
    throw Object.assign(new ApiError(409, 'Ya existe un repartidor con ese documento.'), { campo: 'documento' });
  }
  if (bd.usuarios.some(u => u.email.toLowerCase() === datos.email.toLowerCase() && u.id !== actual?.usuarioId)) {
    throw Object.assign(new ApiError(409, 'Ese correo ya está registrado.'), { campo: 'email' });
  }
}

export async function eliminarRepartidor(id) {
  await cargarBD();
  exigirRol('ADMINISTRADOR', 'OPERADOR');
  const rep = buscar(bd.repartidores, id, 'Repartidor');
  const activos = pedidosActivos(rep.id);
  if (activos) throw new ApiError(409, `${rep.nombre} tiene ${activos} pedido(s) activo(s). Reasígnelos antes de eliminarlo.`);
  bd.repartidores = bd.repartidores.filter(r => r.id !== rep.id);
  const u = bd.usuarios.find(x => x.id === rep.usuarioId);
  if (u) u.activo = false;
  guardar();
  return responder({ ok: true });
}

export async function miPerfilRepartidor() {
  await cargarBD();
  const u = exigirRol('REPARTIDOR');
  const rep = bd.repartidores.find(r => r.usuarioId === u.id);
  if (!rep) throw new ApiError(404, 'Su usuario no tiene un perfil de repartidor.');
  return responder(repartidorConCarga(rep));
}

export async function pedidosDeRepartidor(repId, incluirFinalizados = false) {
  await cargarBD();
  const u = exigirRol();
  if (u.rol === 'REPARTIDOR') {
    const propio = bd.repartidores.find(r => r.usuarioId === u.id);
    if (propio?.id !== Number(repId)) throw new ApiError(403, 'Solo puede consultar sus propios pedidos.');
  }
  const orden = { EN_TRANSITO: 0, ASIGNADO: 1, ENTREGADO: 2, CANCELADO: 3 };
  const lista = bd.pedidos
    .filter(p => p.repartidorId === Number(repId) && (incluirFinalizados || ACTIVOS.includes(p.estado)))
    .map(enriquecerPedido)
    .sort((a, b) => orden[a.estado] - orden[b.estado] || b.fechaActualizacion.localeCompare(a.fechaActualizacion));
  return responder(lista);
}

export async function registrarUbicacion(pedidoId, lat, lng) {
  await cargarBD();
  const u = exigirRol('REPARTIDOR');
  const p = buscar(bd.pedidos, pedidoId, 'Pedido');
  verificarAcceso(u, p);
  if (p.estado !== 'EN_TRANSITO') throw new ApiError(409, 'Solo se registra ubicación de pedidos en tránsito.');
  lat = Number(lat); lng = Number(lng);
  if (!(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)) throw new ApiError(400, 'Coordenadas fuera de rango.');
  const reg = { id: sigId(bd.ubicaciones), repartidorId: p.repartidorId, pedidoId: p.id, lat: +lat.toFixed(6), lng: +lng.toFixed(6), fechaHora: ahora() };
  bd.ubicaciones.push(reg);
  registrarEvento(p.id, 'UBICACION', `Ubicación reportada (${reg.lat}, ${reg.lng})`, u.id);
  guardar();
  return responder(reg);
}

export async function ultimaUbicacion(repId) {
  await cargarBD();
  exigirRol();
  const lista = bd.ubicaciones.filter(x => x.repartidorId === Number(repId)).sort((a, b) => b.fechaHora.localeCompare(a.fechaHora));
  return responder(lista[0] ?? null);
}

export async function listarClientes() {
  await cargarBD();
  exigirRol('ADMINISTRADOR', 'OPERADOR');
  return responder([...bd.clientes].sort((a, b) => a.nombre.localeCompare(b.nombre)));
}

export async function listarUsuarios() {
  await cargarBD();
  exigirRol('ADMINISTRADOR');
  return responder(bd.usuarios.map(({ password, ...resto }) => resto));
}

export async function registrarUsuario(datos) {
  await cargarBD();
  exigirRol('ADMINISTRADOR');
  if (bd.usuarios.some(u => u.email.toLowerCase() === datos.email.toLowerCase())) {
    throw Object.assign(new ApiError(409, 'Ese correo ya está registrado.'), { campo: 'email' });
  }
  const u = { id: sigId(bd.usuarios), nombre: datos.nombre, email: datos.email, password: datos.password, rol: datos.rol, activo: true };
  bd.usuarios.push(u);
  guardar();
  const { password, ...publico } = u;
  return responder(publico);
}

export async function cambiarActivo(id) {
  await cargarBD();
  const yo = exigirRol('ADMINISTRADOR');
  const u = buscar(bd.usuarios, id, 'Usuario');
  if (u.id === yo.id) throw new ApiError(409, 'No puede desactivar su propio usuario.');
  u.activo = !u.activo;
  guardar();
  return responder({ id: u.id, activo: u.activo });
}

export function reiniciarDatos() {
  try { localStorage.removeItem(CLAVE_BD); } catch {}
  bd = null;
}
