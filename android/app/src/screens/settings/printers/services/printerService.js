import AsyncStorage from "@react-native-async-storage/async-storage";
import RNBluetoothClassic from "react-native-bluetooth-classic";
import { encode as btoa } from "base-64";
import RNFS from "react-native-fs";
import { Buffer } from "buffer";
import { PNG } from "pngjs/browser";

const KEY = "SELECTED_PRINTER";
const KEY_LIST = "SAVED_PRINTERS_LIST";

// --- Gestión de almacenamiento ---

export async function savePrinter(printer) {
  await AsyncStorage.setItem(KEY, JSON.stringify(printer));
}

export async function loadPrinter() {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function clearPrinter() {
  await AsyncStorage.removeItem(KEY);
}

// --- Gestión de lista de impresoras ---

export async function getSavedPrintersList() {
  try {
    const raw = await AsyncStorage.getItem(KEY_LIST);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Error loading printers list", e);
    return [];
  }
}

export async function addSavedPrinter(printer) {
  const list = await getSavedPrintersList();
  const exists = list.find((p) => p.address === printer.address);

  if (exists) return list;

  const newPrinter = { ...printer, customName: printer.name };
  const newList = [...list, newPrinter];
  await AsyncStorage.setItem(KEY_LIST, JSON.stringify(newList));
  return newList;
}

export async function removeSavedPrinter(address) {
  const list = await getSavedPrintersList();
  const newList = list.filter((p) => p.address !== address);
  await AsyncStorage.setItem(KEY_LIST, JSON.stringify(newList));

  // Si la impresora borrada era la seleccionada, limpiarla
  const selected = await loadPrinter();
  if (selected && selected.address === address) {
    await clearPrinter();
  }

  return newList;
}

export async function updatePrinterName(address, newName) {
  const list = await getSavedPrintersList();
  const newList = list.map((p) => {
    if (p.address === address) {
      return { ...p, customName: newName };
    }
    return p;
  });
  await AsyncStorage.setItem(KEY_LIST, JSON.stringify(newList));

  // Actualizar la seleccionada si coincide
  const selected = await loadPrinter();
  if (selected && selected.address === address) {
    await savePrinter({ ...selected, customName: newName });
  }

  return newList;
}

// --- Funciones de conexión ---

let connectedDevice = null;

/**
 * Asegura la conexión a la impresora usando RNBluetoothClassic.
 */
export async function ensureConnection(address) {
  // Verificamos si ya estamos conectados a ese dispositivo
  if (connectedDevice && connectedDevice.address === address) {
    const isConnected = await connectedDevice.isConnected();
    if (isConnected) {
        return connectedDevice;
    }
  }

  // Si no, conectamos
  try {
      if (connectedDevice) {
          // Desconectar el anterior si existe
          await connectedDevice.disconnect();
      }

      console.log("Conectando a:", address);
      // Obtener lista de vinculados y buscar por address o id
      const bonded = await RNBluetoothClassic.getBondedDevices();
      const device = bonded.find(d => d.address === address || d.id === address);

      if (!device) {
          throw new Error("Dispositivo no encontrado en vinculados");
      }

      const connected = await device.connect({
        connectorType: "rfcomm",
        SECURE_SOCKET: false // Importante para impresoras chinas baratas
      });

      if (connected) {
          connectedDevice = device;
          return device;
      } else {
          throw new Error("No se pudo conectar");
      }
  } catch (e) {
      connectedDevice = null;
      throw e;
  }
}

export async function disconnectPrinter() {
  if (connectedDevice) {
      await connectedDevice.disconnect();
      connectedDevice = null;
  }
}

// Helper para delay
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Mapeo básico para caracteres latinos comunes (CP437)
const LATIN_MAP = {
  'á': 160, 'í': 161, 'ó': 162, 'ú': 163, 'ñ': 164, 'Ñ': 165,
  'é': 130, 'É': 144,
  'ª': 166, 'º': 167, '¿': 168, 'Á': 181, 'Í': 214, 'Ó': 224,
  'Ú': 233, 'ü': 129, 'Ü': 154, '¡': 173,
  '€': 238
};

function encodeToCP437(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const code = str.charCodeAt(i);

    if (LATIN_MAP[char]) {
      bytes.push(LATIN_MAP[char]);
    } else if (code >= 32 && code <= 126) {
      bytes.push(code);
    } else if (code < 32 || code === 27 || code === 29) {
        bytes.push(code);
    } else {
      bytes.push(63); // '?'
    }
  }
  return bytes;
}

/**
 * Recibe texto o comandos y los envía a la impresora.
 * RNBluetoothClassic maneja Base64.
 */
export async function printRaw(textOrBytes, device) {
  let bytesArray;
  if (typeof textOrBytes === "string") {
    bytesArray = encodeToCP437(textOrBytes);
  } else if (Array.isArray(textOrBytes)) {
    bytesArray = textOrBytes;
  } else if (textOrBytes instanceof Uint8Array) {
    bytesArray = Array.from(textOrBytes);
  } else {
    throw new Error("Tipo de dato no soportado para impresión");
  }

  // Convert to Base64 manually to ensure correct encoding
  // or just send raw bytes if the library supports it well (it does via write but Base64 is safer)

  // Chunking logic (still good practice for bluetooth)
  const CHUNK_SIZE = 200; // Increased chunk size for better lib

  for (let i = 0; i < bytesArray.length; i += CHUNK_SIZE) {
    const chunk = bytesArray.slice(i, i + CHUNK_SIZE);

    // Convert chunk to string binary
    let binary = "";
    for(let j=0; j<chunk.length; j++) {
        binary += String.fromCharCode(chunk[j]);
    }

    // to Base64
    const base64 = btoa(binary);

    try {
        await device.write(base64, "base64");
        // Tiny sleep to prevent buffer overflow on printer side
        await sleep(20);
    } catch (e) {
        console.error("Error sending chunk", e);
        throw e;
    }
  }

  return true;
}

const RASTER_MAX_WIDTH_58MM = 384;
const RASTER_BAND_HEIGHT = 120;

const FONT_5X7 = {
  "A": ["01110","10001","10001","11111","10001","10001","10001"],
  "B": ["11110","10001","10001","11110","10001","10001","11110"],
  "C": ["01111","10000","10000","10000","10000","10000","01111"],
  "D": ["11110","10001","10001","10001","10001","10001","11110"],
  "E": ["11111","10000","10000","11110","10000","10000","11111"],
  "F": ["11111","10000","10000","11110","10000","10000","10000"],
  "G": ["01111","10000","10000","10111","10001","10001","01111"],
  "H": ["10001","10001","10001","11111","10001","10001","10001"],
  "I": ["11111","00100","00100","00100","00100","00100","11111"],
  "J": ["00111","00010","00010","00010","10010","10010","01100"],
  "K": ["10001","10010","10100","11000","10100","10010","10001"],
  "L": ["10000","10000","10000","10000","10000","10000","11111"],
  "M": ["10001","11011","10101","10101","10001","10001","10001"],
  "N": ["10001","11001","10101","10011","10001","10001","10001"],
  "O": ["01110","10001","10001","10001","10001","10001","01110"],
  "P": ["11110","10001","10001","11110","10000","10000","10000"],
  "Q": ["01110","10001","10001","10001","10101","10010","01101"],
  "R": ["11110","10001","10001","11110","10100","10010","10001"],
  "S": ["01111","10000","10000","01110","00001","00001","11110"],
  "T": ["11111","00100","00100","00100","00100","00100","00100"],
  "U": ["10001","10001","10001","10001","10001","10001","01110"],
  "V": ["10001","10001","10001","10001","10001","01010","00100"],
  "W": ["10001","10001","10001","10101","10101","11011","10001"],
  "X": ["10001","10001","01010","00100","01010","10001","10001"],
  "Y": ["10001","10001","01010","00100","00100","00100","00100"],
  "Z": ["11111","00001","00010","00100","01000","10000","11111"],
  "0": ["01110","10001","10011","10101","11001","10001","01110"],
  "1": ["00100","01100","00100","00100","00100","00100","01110"],
  "2": ["01110","10001","00001","00010","00100","01000","11111"],
  "3": ["11110","00001","00001","01110","00001","00001","11110"],
  "4": ["00010","00110","01010","10010","11111","00010","00010"],
  "5": ["11111","10000","10000","11110","00001","00001","11110"],
  "6": ["01110","10000","10000","11110","10001","10001","01110"],
  "7": ["11111","00001","00010","00100","01000","01000","01000"],
  "8": ["01110","10001","10001","01110","10001","10001","01110"],
  "9": ["01110","10001","10001","01111","00001","00001","01110"],
  "-": ["00000","00000","00000","11111","00000","00000","00000"],
  " ": ["00000","00000","00000","00000","00000","00000","00000"],
  ".": ["00000","00000","00000","00000","00000","01100","01100"],
  ",": ["00000","00000","00000","00000","00000","01100","01000"],
  ":": ["00000","01100","01100","00000","01100","01100","00000"],
  "/": ["00001","00010","00100","01000","10000","00000","00000"],
  "#": ["01010","01010","11111","01010","11111","01010","01010"],
  "\$": ["00100","01111","10100","01110","00101","11110","00100"],
};

function normalizeTestLine(line) {
  return line.toUpperCase().replace(/[^A-Z0-9 \-]/g, " ");
}

function normalizeRasterLine(line) {
  const cleaned = line
    .replace(/•/g, "-")
    .replace(/C\$/g, "C");

  return cleaned
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 \-.:/,$#]/g, " ");
}

function renderTextToMonoBitmap(lines, options = {}) {
  const charW = 5;
  const charH = 7;
  const charSpacing = 1;
  const lineSpacing = 2;
  const maxWidth = options.maxWidth || RASTER_MAX_WIDTH_58MM;

  const safeLines = lines;
  const maxChars = Math.max(1, ...safeLines.map((l) => l.length));
  const textWidth = maxChars * (charW + charSpacing) - charSpacing;
  const width = Math.min(maxWidth, textWidth);
  const height = safeLines.length * (charH + lineSpacing) - lineSpacing;

  const bitmap = new Uint8Array(width * height);
  const leftPad = Math.max(0, Math.floor((width - textWidth) / 2));

  safeLines.forEach((line, lineIndex) => {
    let xCursor = leftPad;
    const yCursor = lineIndex * (charH + lineSpacing);

    for (let i = 0; i < line.length; i++) {
      const glyph = FONT_5X7[line[i]] || FONT_5X7[" "];
      for (let y = 0; y < charH; y++) {
        const row = glyph[y];
        for (let x = 0; x < charW; x++) {
          const px = xCursor + x;
          const py = yCursor + y;
          if (px >= 0 && px < width && py >= 0 && py < height) {
            if (row[x] === "1") {
              bitmap[py * width + px] = 1;
            }
          }
        }
      }
      xCursor += charW + charSpacing;
      if (xCursor >= width) break;
    }
  });

  return { bitmap, width, height };
}

function buildRasterImageCommand(lines, normalizer = normalizeRasterLine) {
  const normalized = lines.map((l) => normalizer(l || " "));
  const { bitmap, width, height } = renderTextToMonoBitmap(normalized, { maxWidth: RASTER_MAX_WIDTH_58MM });
  return buildRasterImageCommandFromBitmap(bitmap, width, height);
}

function buildRasterImageCommandFromBitmap(bitmap, width, height) {
  const widthBytes = Math.ceil(width / 8);
  const data = new Uint8Array(widthBytes * height);

  for (let y = 0; y < height; y++) {
    for (let xByte = 0; xByte < widthBytes; xByte++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = xByte * 8 + bit;
        if (x < width && bitmap[y * width + x]) {
          byte |= 0x80 >> bit;
        }
      }
      data[y * widthBytes + xByte] = byte;
    }
  }

  const xL = widthBytes & 0xff;
  const xH = (widthBytes >> 8) & 0xff;
  const yL = height & 0xff;
  const yH = (height >> 8) & 0xff;

  return [0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH, ...Array.from(data)];
}

function buildImageTestPayload(type, printer) {
  const lines = [];
  if (type === "simple") {
    lines.push("HOLA MUNDO", "TEST 58MM");
  } else if (type === "feed") {
    lines.push("FEED", "PAPEL");
  } else {
    lines.push("TEST DE IMPRESION", "CHICKEN INVENTORY");
    if (printer?.name) {
      lines.push(`IMPRESORA ${printer.name}`);
    } else {
      lines.push("IMPRESORA BT");
    }
    lines.push("ESTADO OK");
  }

  const init = [0x1B, 0x40];
  const raster = buildRasterImageCommand(lines, normalizeTestLine);
  const feed = [0x1B, 0x64, 0x03];
  const cut = [0x1D, 0x56, 0x42, 0x00];

  return [...init, ...raster, ...feed, ...cut];
}

function buildImageReceiptPayloadFromText(text) {
  const lines = text.split("\n").map((l) => (l.trim() ? l : " "));
  const init = [0x1B, 0x40];
  const raster = buildRasterImageCommand(lines, normalizeRasterLine);
  const feed = [0x1B, 0x64, 0x04];
  const cut = [0x1D, 0x56, 0x42, 0x00];

  return [...init, ...raster, ...feed, ...cut];
}

function decodePngToMonoBitmap(base64, options = {}) {
  const png = PNG.sync.read(Buffer.from(base64, "base64"));
  const { width, height, data } = png;
  const targetWidth = Math.min(width, options.maxWidth || RASTER_MAX_WIDTH_58MM);
  const scale = targetWidth / width;
  const targetHeight = Math.max(1, Math.round(height * scale));
  const mono = new Uint8Array(targetWidth * targetHeight);
  const threshold = options.threshold ?? 170;
  const invert = options.invert ?? false;

  for (let y = 0; y < targetHeight; y++) {
    const srcY = Math.min(height - 1, Math.floor(y / scale));
    for (let x = 0; x < targetWidth; x++) {
      const srcX = Math.min(width - 1, Math.floor(x / scale));
      const idx = (srcY * width + srcX) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];
      const lum = (0.299 * r + 0.587 * g + 0.114 * b);
      const isBlack = a > 32 && lum < threshold;
      mono[y * targetWidth + x] = invert ? (isBlack ? 0 : 1) : (isBlack ? 1 : 0);
    }
  }

  return { bitmap: mono, width: targetWidth, height: targetHeight };
}

function buildImageReceiptPayloadFromBitmap(bitmap, width, height) {
  const init = [0x1B, 0x40];
  const raster = buildRasterImageCommandFromBitmap(bitmap, width, height);
  const feed = [0x1B, 0x64, 0x04];
  const cut = [0x1D, 0x56, 0x42, 0x00];

  return [...init, ...raster, ...feed, ...cut];
}

function buildRasterBandCommand(bitmap, width, height, yOffset, bandHeight) {
  const widthBytes = Math.ceil(width / 8);
  const data = new Uint8Array(widthBytes * bandHeight);

  for (let y = 0; y < bandHeight; y++) {
    const srcY = yOffset + y;
    if (srcY >= height) break;
    for (let xByte = 0; xByte < widthBytes; xByte++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = xByte * 8 + bit;
        if (x < width && bitmap[srcY * width + x]) {
          byte |= 0x80 >> bit;
        }
      }
      data[y * widthBytes + xByte] = byte;
    }
  }

  const xL = widthBytes & 0xff;
  const xH = (widthBytes >> 8) & 0xff;
  const yL = bandHeight & 0xff;
  const yH = (bandHeight >> 8) & 0xff;

  return [0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH, ...Array.from(data)];
}

async function sendRasterBitmap(deviceObj, bitmap, width, height) {
  await printRaw([0x1B, 0x40], deviceObj);

  for (let y = 0; y < height; y += RASTER_BAND_HEIGHT) {
    const bandHeight = Math.min(RASTER_BAND_HEIGHT, height - y);
    const bandCmd = buildRasterBandCommand(bitmap, width, height, y, bandHeight);
    await printRaw(bandCmd, deviceObj);
  }

  await printRaw([0x1B, 0x64, 0x04], deviceObj);
  await printRaw([0x1D, 0x56, 0x42, 0x00], deviceObj);
}

async function sendEscStarBitmap(deviceObj, bitmap, width, height) {
  await printRaw([0x1B, 0x40], deviceObj);

  const widthL = width & 0xff;
  const widthH = (width >> 8) & 0xff;

  for (let y = 0; y < height; y += 24) {
    const rowCmd = [0x1B, 0x2A, 0x21, widthL, widthH];

    for (let x = 0; x < width; x++) {
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;

      for (let k = 0; k < 8; k++) {
        const y0 = y + k;
        const y1 = y + 8 + k;
        const y2 = y + 16 + k;

        if (y0 < height && bitmap[y0 * width + x]) b0 |= 0x80 >> k;
        if (y1 < height && bitmap[y1 * width + x]) b1 |= 0x80 >> k;
        if (y2 < height && bitmap[y2 * width + x]) b2 |= 0x80 >> k;
      }

      rowCmd.push(b0, b1, b2);
    }

    rowCmd.push(0x0A);
    await printRaw(rowCmd, deviceObj);
  }

  await printRaw([0x1B, 0x64, 0x04], deviceObj);
  await printRaw([0x1D, 0x56, 0x42, 0x00], deviceObj);
}

/**
 * Función genérica para conectar e imprimir cualquier contenido
 */
export async function printTicket(content, printerOverride = null) {
    let printer = printerOverride;
    if (!printer) {
        printer = await loadPrinter();
    }
    if (!printer) throw new Error("No hay impresora seleccionada");

    const deviceObj = await ensureConnection(printer.address);
    await printRaw(content, deviceObj);
}


/**
 * Función para imprimir el recibo completo de venta
 */
export async function printSaleHoin(sale) {
  const device = await loadPrinter();
  if (!device) throw new Error("No hay impresora seleccionada.");

  const ESC = "\x1B";
  const GS = "\x1D";
  const INIT = ESC + "@";
  const CP437 = ESC + "t" + "\x00";
  const ALIGN_CENTER = ESC + "a" + "\x01";
  const ALIGN_LEFT = ESC + "a" + "\x00";
  const BOLD_ON = ESC + "E" + "\x01";
  const BOLD_OFF = ESC + "E" + "\x00";
  const CUT = GS + "V" + "\x42" + "\x00";
  const REVERSE_OFF = GS + "B" + "\x00";
  const NORMAL_SIZE = GS + "!" + "\x00";

  const text = build58mmReceipt(sale);

  let command = "\x00\x00" + INIT + CP437 + REVERSE_OFF + NORMAL_SIZE;
  command += ALIGN_CENTER + BOLD_ON + "CHICKEN INVENTORY\n" + BOLD_OFF + ALIGN_LEFT;
  command += text + "\n\n\n" + CUT;

  await printTicket(command, device);
}

/**
 * Generar recibo 58mm (solo cuerpo de texto)
 */
export function build58mmReceipt(sale) {
  const methodNames = {
    cash: "Efectivo",
    transfer: "Transferencia",
    card: "Tarjeta",
    credit: "Crédito",
  };

  const line = "--------------------------------\n";
  let text = "";
  text += "       TICKET DE VENTA\n";
  text += line;

  text += `Cliente: ${sanitize(sale.customerName || "Genérico")}\n`;
  text += `Usuario: ${sanitize(sale.userName || "---")}\n`;
  text += `Fecha: ${new Date(sale.date).toLocaleString()}\n`;
  text += line;

  text += "Producto          Cnt     Subt\n";

  if (sale.items) {
    sale.items.forEach((item) => {
      const name = sanitize(item.name || item.product?.name || "Item")
        .slice(0, 14);
      const qty = String(item.qty || item.quantity || 1).padStart(3, " ");
      const price = Number(item.price || item.unitPrice || 0);
      const subtotal = price * (item.qty || 1);

      const subStr = subtotal.toFixed(2).padStart(8, " ");
      text += `${name.padEnd(14, " ")} ${qty}   ${subStr}\n`;
    });
  }

  text += line;

  text += `Subtotal:  C$${(sale.subtotal ?? 0).toFixed(2)}\n`;
  text += `Descuento: C$${(sale.discountAmount ?? 0).toFixed(2)}\n`;
  text += `TOTAL:     C$${(sale.total ?? 0).toFixed(2)}\n`;
  if (sale.paidAmount !== undefined)
    text += `Pagado:    C$${(sale.paidAmount ?? 0).toFixed(2)}\n`;

  const method = methodNames[sale.paymentMethod] || sale.paymentMethod || "N/A";
  text += `Método:    ${method}\n`;

  if (sale.transferNumber) {
    text += `Ref: ${sale.transferNumber}\n`;
  }

  text += line;
  text += "Gracias por su compra\n";

  return text;
}

export async function printTest(printer, type = "standard") {
  const device = printer || await loadPrinter();
  if (!device) throw new Error("No hay impresora seleccionada.");
  const deviceObj = await ensureConnection(device.address);
  const payload = buildImageTestPayload(type, device);
  await printRaw(payload, deviceObj);
}

export async function printPreSaleReceiptImage(sale, bonuses = []) {
  const device = await loadPrinter();
  if (!device) throw new Error("No hay impresora seleccionada.");

  const text = buildPreSaleReceiptText(sale, bonuses);
  const payload = buildImageReceiptPayloadFromText(text);
  const deviceObj = await ensureConnection(device.address);
  await printRaw(payload, deviceObj);
}

export async function printPngImageFromUri(uri, options = {}) {
  const device = await loadPrinter();
  if (!device) throw new Error("No hay impresora seleccionada.");

  const filePath = normalizeFileUri(uri);
  const base64 = await RNFS.readFile(filePath, "base64");
  if (!base64) {
    throw new Error("No se pudo leer la imagen del ticket");
  }

  const { bitmap, width, height } = decodePngToMonoBitmap(base64, {
    maxWidth: RASTER_MAX_WIDTH_58MM,
    threshold: options.threshold,
    invert: options.invert,
  });

  if (!width || !height) {
    throw new Error("Imagen del ticket vacia");
  }

  const deviceObj = await ensureConnection(device.address);
  await sendBitmapToPrinter(deviceObj, bitmap, width, height, options);
}

export async function printPngImageFromBase64(base64, options = {}) {
  const device = await loadPrinter();
  if (!device) throw new Error("No hay impresora seleccionada.");

  const normalized = normalizeBase64(base64);
  if (!normalized) {
    throw new Error("No se pudo leer la imagen del ticket");
  }

  const { bitmap, width, height } = decodePngToMonoBitmap(normalized, {
    maxWidth: RASTER_MAX_WIDTH_58MM,
    threshold: options.threshold,
    invert: options.invert,
  });

  if (!width || !height) {
    throw new Error("Imagen del ticket vacia");
  }

  const deviceObj = await ensureConnection(device.address);
  await sendBitmapToPrinter(deviceObj, bitmap, width, height, options);
}

/**
 * Función para imprimir el ticket de entrega
 */
export async function printDeliveryTicket(sale) {
  const device = await loadPrinter();
  if (!device) throw new Error("No hay impresora seleccionada.");

  const ESC = "\x1B";
  const GS = "\x1D";
  const INIT = ESC + "@";
  const ALIGN_CENTER = ESC + "a" + "\x01";
  const ALIGN_LEFT = ESC + "a" + "\x00";
  const BOLD_ON = ESC + "E" + "\x01";
  const BOLD_OFF = ESC + "E" + "\x00";
  const CUT = GS + "V" + "\x42" + "\x00";
  const REVERSE_OFF = GS + "B" + "\x00";
  const NORMAL_SIZE = GS + "!" + "\x00";
  const CHARSET_PC437 = ESC + "t" + "\x00";

  const text = buildDeliveryReceiptText(sale);

  let command = "\x00\x00" + INIT + CHARSET_PC437 + REVERSE_OFF + NORMAL_SIZE;
  command += ALIGN_CENTER + BOLD_ON + "TICKET DE ENTREGA\n" + BOLD_OFF;
  command += "Pre-Venta #" + (sale.id ? sale.id.substring(0, 8).toUpperCase() : "---") + "\n";
  command += ALIGN_LEFT;
  command += text + "\n\n\n" + CUT;

  await printTicket(command, device);
}

function formatReceiptItemLines(rawName, qtyValue, totalValue, nameWidth = 16) {
  const name = sanitize(rawName || "Item");
  const qty = String(qtyValue || 0).padStart(3, " ");
  const totalStr = Number(totalValue || 0).toFixed(2).padStart(8, " ");
  const trimmed = name.slice(0, 32);

  if (trimmed.length > nameWidth) {
    const spacer = " ".repeat(nameWidth);
    return [trimmed, `${spacer} ${qty} ${totalStr}`];
  }

  return [`${trimmed.padEnd(nameWidth, " ")} ${qty} ${totalStr}`];
}

function buildDeliveryReceiptText(sale) {
  const line = "--------------------------------\n";
  let text = "\n";
  text += line;

  const dateStr = getFormattedDate(sale.date || sale.fechaPago);
  text += `Cliente: ${sanitize(sale.customerName || "Cliente General")}\n`;
  text += `Fecha:   ${dateStr}\n`;
  text += line;

  text += "Producto          Cant     Total\n";
  if (sale.items) {
      sale.items.forEach((item) => {
          const rawName = item.productName || item.name || "Item";
          const qtyValue = item.quantity || item.qty || 0;
          const totalVal = item.total || ((item.unitPrice || item.price) * qtyValue);
          const lines = formatReceiptItemLines(rawName, qtyValue, totalVal, 16);
          lines.forEach((lineText) => {
            text += `${lineText}\n`;
          });
      });
  }

  const bonuses = sale.bonusesAwarded || sale.bonuses || [];
  if (bonuses.length > 0) {
      const items = sale.items || [];
      const buildBonusLine = (bonus) => {
        const qty = String(bonus.quantity || bonus.qty || 0);
        const rawName = bonus.productName || bonus.name || "Regalo";
        const bonusName = sanitize(rawName).slice(0, 14);
        const linkedItem = items.find((item) => item.id === bonus.linkedTo || item.productId === bonus.linkedTo);
        const linkedNameRaw = bonus.linkedToName || linkedItem?.productName || linkedItem?.name || "";
        const linkedName = linkedNameRaw ? sanitize(linkedNameRaw).slice(0, 12) : "";
        let lineText = `• ${qty}x ${bonusName}`;
        if (linkedName) {
          lineText += ` (por ${linkedName})`;
        }
        return lineText.slice(0, 32);
      };

      text += line;
      text += "Regalos:\n";
      bonuses.forEach((b) => {
         text += `${buildBonusLine(b)}\n`;
      });
  }

  text += line;

  const total = (sale.total || 0).toFixed(2);
  const paid = (sale.amountPaid || sale.total || 0).toFixed(2);
  const change = (sale.change || 0).toFixed(2);

  text += `TOTAL A PAGAR:     $${total}\n`;
  text += `Pagado:            $${paid}\n`;
  if (Number(change) > 0) {
    text += `Cambio:            $${change}\n`;
  }

  text += line;
  text += "     ¡Gracias por su compra!\n";

  return text;
}

function buildPreSaleReceiptText(sale, bonuses) {
  const line = "--------------------------------";
  let text = "";
  text += "PRE-VENTA PAGADA\n";
  text += line + "\n";

  const dateStr = getFormattedDate(sale.date || sale.fechaPago);
  text += `Cliente: ${sanitize(sale.customerName || "Cliente General")}\n`;
  text += `Fecha:   ${dateStr}\n`;
  text += line + "\n";

  text += "Producto          Cant     Total\n";
  if (sale.items) {
    sale.items.forEach((item) => {
      const rawName = item.productName || item.name || "Item";
      const qtyValue = item.quantity || item.qty || 0;
      const totalVal = item.total || ((item.unitPrice || item.price) * qtyValue);
      const lines = formatReceiptItemLines(rawName, qtyValue, totalVal, 16);
      lines.forEach((lineText) => {
        text += `${lineText}\n`;
      });
    });
  }

  if (bonuses && bonuses.length > 0) {
    text += line + "\n";
    text += "Bonificaciones:\n";
    bonuses.forEach((b) => {
      const bName = sanitize(b.productName || "Prod Bonificado").slice(0, 20);
      text += `- ${b.quantity}x ${bName}\n`;
    });
  }

  text += line + "\n";

  const total = (sale.total || 0).toFixed(2);
  const paid = (sale.amountPaid || sale.total || 0).toFixed(2);
  const change = (sale.change || 0).toFixed(2);

  text += `TOTAL A PAGAR:     C$${total}\n`;
  text += `Pagado:            C$${paid}\n`;
  if (Number(change) > 0) {
    text += `Cambio:            C$${change}\n`;
  }

  text += line + "\n";
  text += "GRACIAS POR SU COMPRA\n";

  return text;
}

function getFormattedDate(date) {
    try {
        if (!date) return new Date().toLocaleString();
        if (typeof date.toDate === 'function') return date.toDate().toLocaleString();
        return new Date(date).toLocaleString();
    } catch (e) {
        return "---";
    }
}

function sanitize(str) {
  if (!str) return "";
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeFileUri(uri) {
  if (!uri) return uri;
  if (uri.startsWith("file://")) {
    return uri.replace("file://", "");
  }
  return uri;
}

function normalizeBase64(base64) {
  if (!base64) return base64;
  const prefix = "data:image/png;base64,";
  return base64.startsWith(prefix) ? base64.slice(prefix.length) : base64;
}

async function sendBitmapToPrinter(deviceObj, bitmap, width, height, options = {}) {
  if (options.mode === "escstar") {
    await sendEscStarBitmap(deviceObj, bitmap, width, height);
  } else {
    await sendRasterBitmap(deviceObj, bitmap, width, height);
  }
}
