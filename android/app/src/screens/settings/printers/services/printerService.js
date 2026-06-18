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

  const customerName58mm = sanitize(sale.customerName || "Generico");
  buildWrappedLabelLines("Cliente", customerName58mm || "Generico", maxChars).forEach((lineText) => {
    text += `${lineText}\n`;
  });
  const address58mm = sanitize(sale.customer?.address || sale.customerAddress || "");
  buildWrappedLabelLines("Direccion", address58mm || "N/A", maxChars).forEach((lineText) => {
    text += `${lineText}\n`;
  });
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

/**
 * Imprime el recibo de una pre-venta pagada directamente desde los datos de Firestore.
 * No usa captura de pantalla — genera el texto del ticket para la impresora térmica.
 *
 * @param {object} sale    - Documento de venta desde Firestore
 * @param {Array}  bonuses - Bonificaciones desde inventoryMovements
 */
export async function printPreSaleDoneReceipt(sale, bonuses = []) {
  const device = await loadPrinter();
  if (!device) throw new Error("No hay impresora seleccionada.");

  const settings = await getTicketCustomizationSettings();
  const maxWidth = resolveRasterWidth(settings.paperWidthMm);
  const scale = resolveFontScale(settings.fontSize);

  // Normalizar nombre del cliente (puede venir como objeto {firstName, lastName})
  const customerName =
    sale?.customer?.firstName
      ? `${sale.customer.firstName} ${sale.customer.lastName || ""}`.trim()
      : sale?.customerName || "Cliente General";

  // Normalizar operador
  const userName =
    sale?.cashierName ||
    sale?.operatorName ||
    sale?.createdBy ||
    sale?.userEmail ||
    "---";

  // Combinar bonos del documento + inventoryMovements sin duplicar
  const saleBonuses = Array.isArray(sale?.bonuses) ? sale.bonuses : [];
  const allBonuses = [...saleBonuses];
  const seen = new Set(saleBonuses.map((b) => `${b.productName || b.name}_${b.quantity}`));
  bonuses.forEach((b) => {
    const key = `${b.productName || b.name}_${b.quantity}`;
    if (!seen.has(key)) { seen.add(key); allBonuses.push(b); }
  });

  const normalizedSale = {
    ...sale,
    customerName,
    customerAddress: sale?.customer?.address || sale?.customerAddress || null,
    userName,
    date: sale?.createdAt,          // getFormattedDate soporta Firestore Timestamp
    bonusesAwarded: allBonuses,
    discountAmount: sale?.totalDiscount ?? 0,
    paidAmount: sale?.amountPaid,
  };

  const text = buildPreSaleReceiptText(normalizedSale, allBonuses, {
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

  // Respetar la configuración de ancho de papel del usuario para escalar la impresión
  const settings = await getTicketCustomizationSettings();
  const maxWidth = resolveRasterWidth(settings.paperWidthMm);

  const { bitmap, width, height } = decodePngToMonoBitmap(normalized, {
    maxWidth,
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
 * Impresión de texto del ticket de entrega (fallback cuando no hay ViewShot).
 * Para WYSIWYG, usar printPngImageFromBase64 con captura de DeliveryTicket.
 */
export async function printDeliveryTicket(sale) {
  const device = await loadPrinter();
  if (!device) throw new Error("No hay impresora seleccionada.");

  const settings = await getTicketCustomizationSettings();
  const maxWidth = resolveRasterWidth(settings.paperWidthMm);
  const scale = resolveFontScale(settings.fontSize);
  const text = `TICKET DE ENTREGA\n${buildDeliveryReceiptText(sale, {
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
  const SEP = "--------------------------------";
  const maxChars = resolveCharsPerLine(layout.maxWidth || RASTER_MAX_WIDTH_58MM, layout.scale || 1, layout.fontFamily);
  const columns = resolveColumns(maxChars);
  let text = "";

  // ── Cabecera ──────────────────────────────────────────────────────────────
  const receiptRef = sale.receiptNumber || sale.saleNumber || sale.preSaleNumber || null;
  const shortId = sale.id ? sale.id.substring(0, 8).toUpperCase() : "---";
  text += receiptRef ? `TICKET #${receiptRef}\n` : `PRE-VENTA #${shortId}\n`;
  text += SEP + "\n";

  // Entregador: quien realizó la entrega/cobro
  // Usa el nombre resuelto si está disponible, fallback al email
  const operator =
    sale.delivererDisplayName ||
    sale.deliveredBy || sale.collectedBy || sale.paidBy || null;

  // Vendedor: quien generó la pre-venta originalmente.
  // Usa el nombre resuelto si está disponible, fallback al email/campo original.
  const seller =
    sale.sellerDisplayName ||
    sale.originalCreatedBy || sale.preSaleCreatedBy ||
    sale.cashierName || sale.operatorName ||
    sale.createdBy || null;

  const isCredit =
    sale.paymentMethod === "credit" ||
    String(sale.status || "").startsWith("credit_");
  const paymentLabel = isCredit
    ? "Credito"
    : ({
        cash: "Efectivo",
        card: "Tarjeta",
        transfer: "Transferencia",
        mixed: "Mixto",
      }[String(sale.paymentMethod || "").toLowerCase()] ||
        sale.paymentMethod ||
        "Contado");

  const customerName = sanitize(sale.customerName || "Cliente General");
  buildWrappedLabelLines("Cliente", customerName || "Cliente General", maxChars).forEach((lineText) => {
    text += `${lineText}\n`;
  });
  const deliveryAddress = sanitize(
    sale.customer?.address || sale.customerAddress || ""
  );
  buildWrappedLabelLines("Direccion", deliveryAddress || "N/A", maxChars).forEach((lineText) => {
    text += `${lineText}\n`;
  });
  text += `Fecha:      ${getFormattedDate(sale.fechaPago || sale.date || sale.createdAt)}\n`;
  text += `Pago:       ${sanitize(paymentLabel)}\n`;
  text += SEP + "\n";

  // ── Ítems con descuentos compactos ───────────────────────────────────────
  text += `[[B]]${formatHeaderLine(columns, { name: "Producto", total: "Total" })}\n`;

  const items = sale.items || [];
  const bonuses = sale.bonusesAwarded || sale.bonuses || [];

  // Índice de bonos por item key para vincularlos
  const bonusByKey = new Map();
  const unlinkedBonuses = [];
  bonuses.forEach((b) => {
    const key =
      b.linkedTo || b.linkedToId || b.linkedItemId || b.linkedProductId || "";
    if (key) {
      const list = bonusByKey.get(key) || [];
      list.push(b);
      bonusByKey.set(key, list);
    } else {
      unlinkedBonuses.push(b);
    }
  });

  items.forEach((item) => {
    // Nombre y total
    const rawName = sanitize(item.productName || item.name || "Item");
    const qty = Number(item.quantity || item.qty || 0);
    const unitPrice = Number(item.unitPrice || item.price || 0);
    const total = Number(item.total || unitPrice * qty);
    // Precio efectivo: total / qty para que qty × precio = total (absorbe descuentos y precio de ruta)
    const effectiveUnitPrice = qty > 0 ? total / qty : unitPrice;
    const totalStr = `C$${total.toFixed(2)}`.padStart(columns.totalWidth);
    const nameLines = splitTextByWidth(rawName, columns.nameWidth);
    const nameFirst = (nameLines[0] || "").padEnd(columns.nameWidth);
    text += `${nameFirst} ${totalStr}\n`;
    // Continuaciones del nombre sin recortar
    nameLines.slice(1).forEach((linePart) => {
      text += `${linePart.padEnd(columns.nameWidth)} ${"".padStart(columns.totalWidth)}\n`;
    });

    // Segunda línea: cantidad × precio unitario
    const detailLine = `${qty} x C$${effectiveUnitPrice.toFixed(2)}`;
    text += `  ${detailLine}\n`;


    // Bonos vinculados a este ítem
    const itemKey = item.id || item.productId || item.product?.id || "";
    if (itemKey) {
      const linked = bonusByKey.get(itemKey) || [];
      // Agregar por nombre para deduplicar
      const aggMap = new Map();
      linked.forEach((b) => {
        const bName = sanitize(b.productName || b.name || "Bonif");
        const bQty = Number(b.quantity || b.qty || b.bonusQty || 0);
        const existing = aggMap.get(bName) || 0;
        aggMap.set(bName, existing + bQty);
      });
      aggMap.forEach((bQty, bName) => {
        const prefix = `  Regalo: +${bQty} `;
        const bonusLines = splitTextByWidth(bName, Math.max(1, columns.maxChars - prefix.length));
        bonusLines.forEach((linePart, idx) => {
          text += idx === 0 ? `${prefix}${linePart}\n` : `${" ".repeat(prefix.length)}${linePart}\n`;
        });
       });
     }

    text += "\n"; // separador entre ítems
  });

  // Bonos sin vínculo
  if (unlinkedBonuses.length > 0) {
    text += "Bonificaciones adicionales:\n";
    const aggMap = new Map();
    unlinkedBonuses.forEach((b) => {
      const bName = sanitize(b.productName || b.name || "Bonif");
      const bQty = Number(b.quantity || b.qty || b.bonusQty || 0);
      aggMap.set(bName, (aggMap.get(bName) || 0) + bQty);
    });
    aggMap.forEach((bQty, bName) => {
      const prefix = `  +${bQty} `;
      const bonusLines = splitTextByWidth(bName, Math.max(1, columns.maxChars - prefix.length));
      bonusLines.forEach((linePart, idx) => {
        text += idx === 0 ? `${prefix}${linePart}\n` : `${" ".repeat(prefix.length)}${linePart}\n`;
      });
    });
    text += "\n";
  }

  text += SEP + "\n";

  const total = (sale.total || 0).toFixed(2);
  const paid = (sale.amountPaid || sale.total || 0).toFixed(2);
  const change = (sale.change || 0).toFixed(2);

  text += `[[B]]TOTAL A PAGAR:     C$${total}\n`;
  text += `Pagado:            C$${paid}\n`;
  if (Number(change) > 0) {
    text += `Cambio:            C$${change}\n`;
  }

  text += SEP + "\n";
  if (seller) text += `Vendedor:   ${sanitize(seller)}\n`;
  if (operator) text += `Entregador: ${sanitize(operator)}\n`;
  text += "     Gracias por su compra\n";

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
  const customerAddress = sanitize(
    sale.customer?.address || sale.customerAddress || ""
  );
  // Vendedor: usar nombre resuelto si está disponible, fallback a campos de email
  const vendedor = sanitize(
    sale.sellerDisplayName ||
    sale.preSaleCreatedBy || sale.originalCreatedBy || sale.userName || "---"
  );
  // Entregador: usar nombre resuelto si está disponible
  const entregador = sanitize(
    sale.delivererDisplayName ||
    sale.deliveredBy || sale.collectedBy || sale.paidBy || ""
  );
  const preSaleCustomerName = sanitize(sale.customerName || "Cliente General");
  buildWrappedLabelLines("Cliente", preSaleCustomerName || "Cliente General", maxChars).forEach((lineText) => {
    text += `${lineText}\n`;
  });
  buildWrappedLabelLines("Direccion", customerAddress || "N/A", maxChars).forEach((lineText) => {
    text += `${lineText}\n`;
  });
  text += `Vendedor: ${vendedor}\n`;
  if (entregador) text += `Entregador: ${entregador}\n`;
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

function splitTextByWidth(value, width) {
  const maxWidth = Math.max(1, Number(width) || 1);
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];

  const lines = [];
  let current = "";

  words.forEach((word) => {
    let rest = word;

    while (rest.length > maxWidth) {
      if (current) {
        lines.push(current);
        current = "";
      }
      lines.push(rest.slice(0, maxWidth));
      rest = rest.slice(maxWidth);
    }

    if (!rest) return;
    if (!current) {
      current = rest;
      return;
    }

    const candidate = `${current} ${rest}`;
    if (candidate.length <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = rest;
    }
  });

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function buildWrappedLabelLines(label, value, maxChars) {
  const safeLabel = sanitize(label || "");
  const prefix = `${safeLabel}: `;
  const available = Math.max(1, (Number(maxChars) || 32) - prefix.length);
  const wrapped = splitTextByWidth(sanitize(value || ""), available);
  const indent = " ".repeat(prefix.length);

  return wrapped.map((line, index) => (index === 0 ? `${prefix}${line}` : `${indent}${line}`));
}

function sanitize(str) {
  if (!str) return "";
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}