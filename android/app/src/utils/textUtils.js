/**
 * Normaliza texto para búsquedas: minúsculas y sin marcas diacríticas, de modo
 * que "martinez" encuentre a "Martínez" y "pena" a "Peña". Se aplica al término
 * buscado y al texto buscado por igual.
 */
export const normalizeText = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
