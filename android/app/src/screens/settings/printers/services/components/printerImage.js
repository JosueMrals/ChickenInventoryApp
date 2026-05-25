import RNFS from "react-native-fs";
import { Buffer } from "buffer";
import { PNG } from "pngjs/browser";
import { printRaw } from "./printerTransport";
import { buildRasterImageCommandFromBitmap } from "./printerRaster";

function normalizeFileUri(uri) {
  if (!uri) return uri;
  if (uri.startsWith("file://")) {
    return uri.replace("file://", "");
  }
  return uri;
}

async function readImageBase64FromUri(uri) {
  if (!uri) return "";
  const normalized = normalizeFileUri(uri);
  try {
    const base64 = await RNFS.readFile(normalized, "base64");
    if (base64) return base64;
  } catch (error) {
    // Fallback al URI original si el normalizado falla.
  }

  try {
    const base64 = await RNFS.readFile(uri, "base64");
    if (base64) return base64;
  } catch (error) {
    // Ignorar y devolver vacio.
  }

  return "";
}

function normalizeBase64(base64) {
  if (!base64) return base64;
  const prefix = "data:image/png;base64,";
  return base64.startsWith(prefix) ? base64.slice(prefix.length) : base64;
}

function decodePngToMonoBitmap(base64, options = {}) {
  const buffer = Buffer.from(base64, "base64");
  const png = PNG.sync.read(buffer);
  let width = png.width;
  let height = png.height;
  let data = png.data;

  const maxWidth = options.maxWidth || width;
  // Escalar siempre al ancho objetivo (tanto reducir como ampliar para impresión)
  if (maxWidth && width !== maxWidth) {
    const scaled = resizeRgbaNearest(data, width, height, maxWidth);
    data = scaled.data;
    width = scaled.width;
    height = scaled.height;
  }

  const threshold = Number(options.threshold ?? 128);
  const invert = Boolean(options.invert);
  const bitmap = new Uint8Array(width * height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      let isBlack = a > 8 && luminance < threshold;
      if (invert) isBlack = !isBlack;
      bitmap[y * width + x] = isBlack ? 1 : 0;
    }
  }

  return { bitmap, width, height };
}

function resizeRgbaNearest(data, width, height, targetWidth) {
  const ratio = targetWidth / width;
  const targetHeight = Math.max(1, Math.round(height * ratio));
  const scaled = new Uint8Array(targetWidth * targetHeight * 4);

  for (let y = 0; y < targetHeight; y++) {
    const srcY = Math.min(height - 1, Math.floor(y / ratio));
    for (let x = 0; x < targetWidth; x++) {
      const srcX = Math.min(width - 1, Math.floor(x / ratio));
      const srcIdx = (srcY * width + srcX) * 4;
      const dstIdx = (y * targetWidth + x) * 4;
      scaled[dstIdx] = data[srcIdx];
      scaled[dstIdx + 1] = data[srcIdx + 1];
      scaled[dstIdx + 2] = data[srcIdx + 2];
      scaled[dstIdx + 3] = data[srcIdx + 3];
    }
  }

  return { data: scaled, width: targetWidth, height: targetHeight };
}

/**
 * Elimina filas completamente en blanco del final del bitmap.
 *
 * Cuando ViewShot captura una vista, puede incluir píxeles en blanco extra al final
 * provenientes de: padding del contenedor, DPR del dispositivo, márgenes de ScrollView, etc.
 * Esas filas en blanco se imprimen como papel en blanco → "excedente igual al tamaño del ticket".
 *
 * @param {Uint8Array} bitmap   - bitmap monocromo (1=negro, 0=blanco)
 * @param {number}     width    - ancho en píxeles
 * @param {number}     height   - alto en filas
 * @param {number}     [marginRows=40] - filas de margen a conservar tras el último contenido (~5mm a 203dpi)
 */
function trimBitmapBlankRows(bitmap, width, height, marginRows = 40) {
  let lastContentRow = 0;

  // Escanear desde la última fila hacia arriba para encontrar el último contenido
  outer: for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      if (bitmap[y * width + x]) {
        lastContentRow = y;
        break outer;
      }
    }
  }

  const newHeight = Math.min(height, lastContentRow + 1 + marginRows);

  // Solo recortar cuando hay ganancia significativa (>= 80 filas ≈ 10mm a 203dpi)
  if (height - newHeight < 80) return { bitmap, width, height };

  const trimmed = new Uint8Array(width * newHeight);
  trimmed.set(bitmap.subarray(0, width * newHeight));

  console.log(
    `[printer] bitmap recortado: ${height}px → ${newHeight}px (eliminadas ${height - newHeight} filas en blanco)`
  );

  return { bitmap: trimmed, width, height: newHeight };
}

async function sendBitmapToPrinter(deviceObj, bitmap, width, height, options = {}) {
  if (options.mode === "escstar") {
    await sendEscStarBitmap(deviceObj, bitmap, width, height);
  } else {
    await sendRasterBitmap(deviceObj, bitmap, width, height);
  }
}

async function sendRasterBitmap(deviceObj, bitmap, width, height) {
  // ── Recortar filas en blanco del final (fix principal del excedente de papel) ──
  const { bitmap: tb, width: tw, height: th } = trimBitmapBlankRows(bitmap, width, height);

  const raster = buildRasterImageCommandFromBitmap(tb, tw, th);
  const init = [0x1B, 0x40];
  // Feed 2 líneas (~8mm) para facilitar el desgarre
  const feed = [0x1B, 0x64, 0x02];
  // GS V B 0: corte parcial, 0 líneas extra antes del corte (máxima compatibilidad)
  const cut = [0x1D, 0x56, 0x42, 0x00];
  await printRaw([...init, ...raster, ...feed, ...cut], deviceObj);
}

async function sendEscStarBitmap(deviceObj, bitmap, width, height) {
  await sendRasterBitmap(deviceObj, bitmap, width, height);
}

export {
  normalizeFileUri,
  readImageBase64FromUri,
  normalizeBase64,
  decodePngToMonoBitmap,
  sendBitmapToPrinter,
};
