import AsyncStorage from "@react-native-async-storage/async-storage";
import RNBluetoothClassic from "react-native-bluetooth-classic";
import { encode as btoa } from "base-64";

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
      // Crear instancia del dispositivo por address (no conecta aún)
      const device = await RNBluetoothClassic.getBondedDevice(address);

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

export async function printTest(printer) {
      const ESC = "\x1B";
      const GS = "\x1D";
      const INIT = ESC + "@";
      const CP437 = ESC + "t" + "\x00";
      const ALIGN_CENTER = ESC + "a" + "\x01";
      const ALIGN_LEFT = ESC + "a" + "\x00";
      const CUT = GS + "V" + "\x42" + "\x00";
      const BOLD_ON = ESC + "E" + "\x01";
      const BOLD_OFF = ESC + "E" + "\x00";
      const DOUBLE_HEIGHT = GS + "!" + "\x10";
      const NORMAL = GS + "!" + "\x00";

      let cmd = "\x00\x00" + INIT + CP437;

      cmd += ALIGN_CENTER;
      cmd += DOUBLE_HEIGHT + BOLD_ON + "TEST DE IMPRESION\n" + BOLD_OFF + NORMAL;
      cmd += "Chicken Inventory App\n\n";
      cmd += ALIGN_LEFT;

      cmd += "Impresora: " + (printer ? printer.name : "Default") + "\n";
      cmd += "Direccion: " + (printer ? printer.address : "---") + "\n";
      cmd += "Fecha: " + new Date().toLocaleString() + "\n";
      cmd += "--------------------------------\n";
      cmd += ALIGN_CENTER + BOLD_ON + "PRUEBA DE CARACTERES" + BOLD_OFF + ALIGN_LEFT + "\n";
      cmd += "Acentos: á é í ó ú ñ Ñ\n";
      cmd += "Simbolos: $ % & / ( ) = ? ¡ ! @\n";
      cmd += "Numeros: 1234567890\n";
      cmd += "--------------------------------\n";

      // Debug Info en el propio ticket para validar
      cmd += "DEBUG INFO:\n";
      cmd += "Encoding: CP437 forced (ESC t 0)\n";
      cmd += "Kanji Mode: OFF (FS .)\n";
      cmd += "--------------------------------\n";

      const INVERT_ON = GS + "B" + "\x01";
      const INVERT_OFF = GS + "B" + "\x00";
      cmd += ALIGN_CENTER + INVERT_ON + " TEXTO INVERTIDO " + INVERT_OFF + ALIGN_LEFT + "\n\n";

      cmd += "Si puedes leer esto,\nla impresora esta configurada\ncorrectamente.\n";
      cmd += "\n\n\n" + CUT;

      console.log("[PRINTER_SERVICE] Enviando comando de test (Standard).");
      await printTicket(cmd, printer);
}

/**
 * Función para imprimir el ticket de entrega (Entrega Bodega -> Repartidor)
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
          const name = sanitize(rawName).slice(0, 16);
          const qty = String(item.quantity || item.qty || 0).padStart(3, " ");
          const totalVal = (item.total || ((item.unitPrice || item.price) * (item.quantity || item.qty))).toFixed(2);
          const totalStr = totalVal.padStart(8, " ");
          text += `${name.padEnd(16, " ")} ${qty} ${totalStr}\n`;
      });
  }

  if (sale.bonusesAwarded && sale.bonusesAwarded.length > 0) {
      text += line;
      text += "Bonificaciones:\n";
      sale.bonusesAwarded.forEach(b => {
         const bName = sanitize(b.productName || 'Prod Bonificado').slice(0, 20);
         text += `• ${b.quantity}x ${bName}\n`;
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
