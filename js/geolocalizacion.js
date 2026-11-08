export function obtenerUbicacionNavegador() {
  const simulada = () => ({ lat: +(4.62 + Math.random() * 0.08).toFixed(6), lng: +(-74.12 + Math.random() * 0.07).toFixed(6), simulada: true });
  if (!('geolocation' in navigator)) return Promise.resolve(simulada());
  return new Promise(resolver => {
    navigator.geolocation.getCurrentPosition(
      pos => resolver({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolver(simulada()),
      { enableHighAccuracy: true, timeout: 6000 },
    );
  });
}
