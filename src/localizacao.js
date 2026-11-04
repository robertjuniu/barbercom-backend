export function coordenadas(latitude, longitude) {
  const vazio = value => value === undefined || value === null || value === '';
  if (vazio(latitude) && vazio(longitude)) return null;
  const valido = (value, max) => typeof value === 'string' && /^-?\d{1,3}(\.\d{1,8})?$/.test(value) && Math.abs(Number(value)) <= max;
  if (!valido(latitude, 90) || !valido(longitude, 180)) {
    throw Object.assign(new Error('Informe latitude (-90 a 90) e longitude (-180 a 180), juntas e com ponto decimal.'), { status: 400 });
  }
  return { latitude: Number(latitude), longitude: Number(longitude) };
}

export function distanciaKm(origem, destino) {
  if (!origem || destino.latitude === null || destino.longitude === null) return null;
  const rad = grau => grau * Math.PI / 180;
  const a = Math.sin(rad(destino.latitude - origem.latitude) / 2) ** 2
    + Math.cos(rad(origem.latitude)) * Math.cos(rad(destino.latitude)) * Math.sin(rad(destino.longitude - origem.longitude) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}
