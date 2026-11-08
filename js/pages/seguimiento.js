import { seguimientoPublico } from '../api.js';
import { R, conectarValidacion, marcarError } from '../validaciones.js';
import { $, esc, badgeEstado, formatoFecha, conCarga, parametroURL } from '../ui.js';
import { ESTADOS } from '../config.js';

const form = $('#form-seguimiento');
const resultado = $('#resultado');

conectarValidacion(form, {
  codigo: [R.requerido('Ingrese el código de seguimiento'), R.codigoSeguimiento()],
}, async (datos, boton) => {
  resultado.innerHTML = '';
  try {
    const p = await conCarga(boton, () => seguimientoPublico(datos.codigo));
    resultado.innerHTML = `
      <div class="pedido-card">
        <header><b>${esc(p.codigo)}</b>${badgeEstado(p.estado)}</header>
        <p class="texto-suave">Destino: ${esc(p.destino)}<br>Última actualización: ${formatoFecha(p.fechaActualizacion)}</p>
        <h2 style="margin-top:14px;font-size:1rem">Historial</h2>
        <ul class="timeline">
          ${p.eventos.map(e => `<li><b>${ESTADOS[e.estado] ?? e.estado}</b><small>${formatoFecha(e.fechaHora)}</small></li>`).join('')}
        </ul>
        <p class="texto-suave" style="font-size:.8rem">Por seguridad no se muestran datos personales del repartidor.</p>
      </div>`;
  } catch (e) {
    marcarError(form, 'codigo', e.message);
  }
});

const inicial = parametroURL('codigo');
if (inicial) { form.elements.codigo.value = inicial; form.requestSubmit(); }
