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
  if (width > maxWidth) {
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

async function sendBitmapToPrinter(deviceObj, bitmap, width, height, options = {}) {
  if (options.mode === "escstar") {
    await sendEscStarBitmap(deviceObj, bitmap, width, height);
  } else {
    await sendRasterBitmap(deviceObj, bitmap, width, height);
  }
}

async function sendRasterBitmap(deviceObj, bitmap, width, height) {
  const raster = buildRasterImageCommandFromBitmap(bitmap, width, height);
  const init = [0x1B, 0x40];
  const feed = [0x1B, 0x64, 0x04];
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

