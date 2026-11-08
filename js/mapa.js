import { esc } from './ui.js';

export function distanciaKm(a, b) {
  const rad = g => (g * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export function pintarMapa(contenedor, destino, ubicacion) {
  if (!window.L) {
    contenedor.innerHTML = `<div class="mapa-alterno">Mapa no disponible sin conexión.<br>
      Destino: ${destino.lat}, ${destino.lng}${ubicacion ? `<br>Repartidor: ${ubicacion.lat}, ${ubicacion.lng}` : ''}</div>`;
    return;
  }
  const mapa = L.map(contenedor).setView([destino.lat, destino.lng], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '&copy; OpenStreetMap',
  }).addTo(mapa);
  const puntos = [[destino.lat, destino.lng]];
  L.circleMarker([destino.lat, destino.lng], { radius: 9, color: '#c62828', fillOpacity: .8 })
    .addTo(mapa).bindPopup(`<b>Destino</b><br>${esc(destino.texto)}`);
  if (ubicacion) {
    puntos.push([ubicacion.lat, ubicacion.lng]);
    L.circleMarker([ubicacion.lat, ubicacion.lng], { radius: 9, color: '#1f4e79', fillOpacity: .8 })
      .addTo(mapa).bindPopup('<b>Repartidor</b><br>Última ubicación reportada');
    L.polyline(puntos, { color: '#1f4e79', dashArray: '6 6', weight: 2 }).addTo(mapa);
    mapa.fitBounds(puntos, { padding: [30, 30] });
  }
}
