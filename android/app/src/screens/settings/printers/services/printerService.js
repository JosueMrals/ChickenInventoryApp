import { getTicketCustomizationSettings } from "../../ticketCustomization/ticketCustomizationService";
import {
  addSavedPrinter,
  clearPrinter,
  getSavedPrintersList,
  loadPrinter,
  removeSavedPrinter,
  savePrinter,
  updatePrinterName,
} from "./components/printerStorage";
import {
  disconnectPrinter,
  ensureConnection,
  printRaw,
  printTicket,
} from "./components/printerTransport";
import {
  RASTER_MAX_WIDTH_58MM,
  buildImageReceiptPayloadFromBitmap,
  buildImageReceiptPayloadFromText,
  buildImageTestPayload,
  concatBitmapsVertical,
  normalizeRasterLine,
  renderTextToMonoBitmap,
  resolveFontScale,
  resolveRasterWidth,
} from "./components/printerRaster";
import {
  buildItemsWithBonusesBlock,
  formatHeaderLine,
  resolveCharsPerLine,
  resolveColumns,
} from "./components/receiptFormatter";
import {
  decodePngToMonoBitmap,
  normalizeBase64,
  normalizeFileUri,
  readImageBase64FromUri,
  sendBitmapToPrinter,
} from "./components/printerImage";

export {
  addSavedPrinter,
  clearPrinter,
  getSavedPrintersList,
  loadPrinter,
  removeSavedPrinter,
  savePrinter,
  updatePrinterName,
};
export { disconnectPrinter, ensureConnection, printRaw, printTicket };
export { RASTER_MAX_WIDTH_58MM, resolveRasterWidth, resolveFontScale };

async function buildImageReceiptPayloadFromTextWithHeader(text, headerImageUri, options = {}) {
  const maxWidth = options.maxWidth || RASTER_MAX_WIDTH_58MM;
  const rawLines = Array.isArray(text) ? text : text.split("\n");
  const boldMarker = options.boldMarker || "";
  const boldLineIndexes = [];
  const lines = rawLines.map((l, index) => {
    if (boldMarker && l.startsWith(boldMarker)) {
      boldLineIndexes.push(index);
      return l.slice(boldMarker.length);
    }
    return l;
  }).map((l) => (l.trim() ? l : " "));
  const normalized = lines.map((l) => normalizeRasterLine(l || " "));
  const textBitmap = renderTextToMonoBitmap(normalized, {
    maxWidth,
    scale: options.scale || 1,
    fontFamily: options.fontFamily,
    boldLineIndexes,
  });

  const bitmaps = [textBitmap];
  if (headerImageUri || options.headerBase64) {
    try {
      const base64Raw = options.headerBase64 || await readImageBase64FromUri(headerImageUri);
      const base64 = normalizeBase64(base64Raw);
      if (base64) {
        const headerBitmap = decodePngToMonoBitmap(base64, {
          maxWidth,
          threshold: options.threshold,
          invert: options.invert,
        });
        if (headerBitmap?.width && headerBitmap?.height) {
          bitmaps.unshift(headerBitmap);
        }
      }
    } catch (error) {
      console.log("Header image read error:", error);
    }
  }

  const merged = concatBitmapsVertical(bitmaps, maxWidth, options.gap ?? 8);
  if (!merged.width || !merged.height) {
    return buildImageReceiptPayloadFromText(text, options);
  }

  return buildImageReceiptPayloadFromBitmap(merged.bitmap, merged.width, merged.height);
}

export async function printSaleHoin(sale) {
  const device = await loadPrinter();
  if (!device) throw new Error("No hay impresora seleccionada.");

  const settings = await getTicketCustomizationSettings();
  const maxWidth = resolveRasterWidth(settings.paperWidthMm);
  const scale = resolveFontScale(settings.fontSize);
  const text = `CHICKEN INVENTORY\n${build58mmReceipt(sale, {
    maxWidth,
    scale,
    fontFamily: settings.fontFamily,
  })}`;

  const payload = await buildImageReceiptPayloadFromTextWithHeader(text, settings.headerImageUri, {
    maxWidth,
    scale,
    fontFamily: settings.fontFamily,
    headerBase64: settings.headerImageBase64,
    boldMarker: "[[B]]",
  });

  await printTicket(payload, device);
}

/**
 * Generar recibo 58mm (solo cuerpo de texto)
 */
export function build58mmReceipt(sale, layout = {}) {
  const methodNames = {
    cash: "Efectivo",
    transfer: "Transferencia",
    card: "Tarjeta",
    credit: "Crédito",
  };

  const line = "--------------------------------\n";
  const maxChars = resolveCharsPerLine(layout.maxWidth || RASTER_MAX_WIDTH_58MM, layout.scale || 1, layout.fontFamily);
  const columns = resolveColumns(maxChars);
  let text = "";
  text += "       TICKET DE VENTA\n";
  text += line;

  text += `Cliente: ${sanitize(sale.customerName || "Genérico")}\n`;
  text += `Usuario: ${sanitize(sale.userName || "---")}\n`;
  text += `Fecha: ${new Date(sale.date).toLocaleString()}\n`;
  text += line;

  text += `[[B]]${formatHeaderLine(columns, { name: "Producto", total: "Subt" })}\n`;

  const itemLines = buildItemsWithBonusesBlock(sale.items || [], sale.bonusesAwarded || sale.bonuses || [], columns, {
    currency: "C$",
    sanitize,
  });
  itemLines.forEach((lineText) => {
    text += `${lineText}\n`;
  });

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

  const settings = await getTicketCustomizationSettings();
  const maxWidth = resolveRasterWidth(settings.paperWidthMm);
  const scale = resolveFontScale(settings.fontSize);
  const text = buildPreSaleReceiptText(sale, bonuses, {
    maxWidth,
    scale,
    fontFamily: settings.fontFamily,
  });

  const payload = await buildImageReceiptPayloadFromTextWithHeader(text, settings.headerImageUri, {
    maxWidth,
    scale,
    fontFamily: settings.fontFamily,
    headerBase64: settings.headerImageBase64,
    boldMarker: "[[B]]",
  });

  const deviceObj = await ensureConnection(device.address);
  await printRaw(payload, deviceObj);
}

export async function printPngImageFromUri(uri, options = {}) {
  const device = await loadPrinter();
  if (!device) throw new Error("No hay impresora seleccionada.");

  const filePath = normalizeFileUri(uri);
  const base64 = await readImageBase64FromUri(filePath);
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

  const settings = await getTicketCustomizationSettings();
  const maxWidth = resolveRasterWidth(settings.paperWidthMm);
  const scale = resolveFontScale(settings.fontSize);
  const preSaleId = sale.id ? sale.id.substring(0, 8).toUpperCase() : "---";
  const text = `TICKET DE ENTREGA\nPre-Venta #${preSaleId}\n${buildDeliveryReceiptText(sale, {
    maxWidth,
    scale,
    fontFamily: settings.fontFamily,
  })}`;

  const payload = await buildImageReceiptPayloadFromTextWithHeader(text, settings.headerImageUri, {
    maxWidth,
    scale,
    fontFamily: settings.fontFamily,
    headerBase64: settings.headerImageBase64,
    boldMarker: "[[B]]",
  });

  await printTicket(payload, device);
}

function buildDeliveryReceiptText(sale, layout = {}) {
  const line = "--------------------------------\n";
  const maxChars = resolveCharsPerLine(layout.maxWidth || RASTER_MAX_WIDTH_58MM, layout.scale || 1, layout.fontFamily);
  const columns = resolveColumns(maxChars);
  let text = "\n";
  text += line;

  const dateStr = getFormattedDate(sale.date || sale.fechaPago);
  text += `Cliente: ${sanitize(sale.customerName || "Cliente General")}\n`;
  text += `Fecha: ${dateStr}\n`;
  text += line;

  text += `[[B]]${formatHeaderLine(columns)}\n`;
  const itemLines = buildItemsWithBonusesBlock(sale.items || [], sale.bonusesAwarded || sale.bonuses || [], columns, {
    currency: "C$",
    sanitize,
  });
  itemLines.forEach((lineText) => {
    text += `${lineText}\n`;
  });

  text += line;

  const total = (sale.total || 0).toFixed(2);
  const paid = (sale.amountPaid || sale.total || 0).toFixed(2);
  const change = (sale.change || 0).toFixed(2);

  text += `[[B]]TOTAL A PAGAR:     C$${total}\n`;
  text += `Pagado:            C$${paid}\n`;
  if (Number(change) > 0) {
    text += `Cambio:            C$${change}\n`;
  }

  text += line;
  text += "     ¡Gracias por su compra!\n";

  return text;
}

function buildPreSaleReceiptText(sale, bonuses, layout = {}) {
  const line = "--------------------------------";
  const maxChars = resolveCharsPerLine(layout.maxWidth || RASTER_MAX_WIDTH_58MM, layout.scale || 1, layout.fontFamily);
  const columns = resolveColumns(maxChars);
  let text = "";
  text += "PRE-VENTA PAGADA\n";
  text += line + "\n";

  const dateStr = getFormattedDate(sale.date || sale.fechaPago);
  text += `Cliente: ${sanitize(sale.customerName || "Cliente General")}\n`;
  text += `Fecha:   ${dateStr}\n`;
  text += line + "\n";

  text += `[[B]]${formatHeaderLine(columns, { name: "Producto", total: "Total" })}\n`;
  const itemLines = buildItemsWithBonusesBlock(sale.items || [], sale.bonusesAwarded || sale.bonuses || [], columns, {
    currency: "C$",
    sanitize,
  });
  itemLines.forEach((lineText) => {
    text += `${lineText}\n`;
  });


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