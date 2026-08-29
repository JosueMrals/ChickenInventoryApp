import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

// ─────────────────────────────────────────────────────────────────────────────
//  MÓDULO: Recepción de Mercancía
//
//  Registra la entrada de productos al inventario (compras a proveedor). Cada
//  recepción incrementa el stock de forma transaccional y deja rastro completo:
//    · goodsReceipts/{id}         → cabecera + líneas embebidas (documento vivo)
//    · inventoryMovements/{id}     → una entrada por línea (feed cronológico plano)
//    · counters/goodsReceiptCounter→ consecutivo legible (N.º de recepción)
//
//  Toda la lógica de cálculo/validación es PURA (sin Firestore) para poder
//  probarla; las operaciones de escritura usan transacción con relectura para
//  ser seguras ante concurrencia y reintentos offline.
// ─────────────────────────────────────────────────────────────────────────────

const receiptsCollection = () => firestore().collection('goodsReceipts');
const movementsCollection = () => firestore().collection('inventoryMovements');
const productsCollection = () => firestore().collection('products');
const counterRef = () => firestore().collection('counters').doc('goodsReceiptCounter');

export const RECEIPT_STATUS = {
  COMPLETED: 'completed',
  VOIDED: 'voided',
};

// Redondeo monetario a 2 decimales evitando el arrastre binario (0.1+0.2).
export function round2(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

// ── Normalización de una línea de recepción ──────────────────────────────────
// Acepta la forma flexible que entra desde la UI (product seleccionado + qty +
// costo) y produce siempre la misma forma canónica.
export function normalizeReceiptItem(item = {}) {
  const quantity = Number(item.quantity ?? item.qty ?? 0);
  const unitCost = Number(item.unitCost ?? item.cost ?? item.price ?? 0);
  return {
    productId: item.productId || item.id || null,
    productName: item.productName || item.name || '',
    category: typeof item.category === 'string' ? item.category.trim() : '',
    quantity,
    unitCost,
    lineCost: round2(quantity * unitCost),
  };
}

// ── Totales de una recepción ─────────────────────────────────────────────────
export function computeReceiptTotals(items = []) {
  const norm = items.map(normalizeReceiptItem);
  const totalUnits = norm.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
  const totalCost = round2(norm.reduce((sum, i) => sum + (Number(i.lineCost) || 0), 0));
  return { itemCount: norm.length, totalUnits, totalCost };
}

// ── Validación del borrador antes de guardar ─────────────────────────────────
// Devuelve { ok, message }. Reglas:
//   · proveedor y número de factura/referencia obligatorios
//   · al menos una línea
//   · cada línea con productId, cantidad numérica > 0 y costo unitario >= 0
//   · sin productos duplicados (evita doble conteo silencioso)
export function validateReceptionDraft({ items, supplier, reference } = {}) {
  if (!supplier || !supplier.trim()) {
    return { ok: false, message: 'El nombre del proveedor es obligatorio.' };
  }
  if (!reference || !reference.trim()) {
    return { ok: false, message: 'El número de factura es obligatorio.' };
  }

  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) {
    return { ok: false, message: 'Agrega al menos un producto a la recepción.' };
  }

  const seen = new Set();
  for (const raw of list) {
    const item = normalizeReceiptItem(raw);
    if (!item.productId) {
      return { ok: false, message: 'Hay una línea sin producto asignado.' };
    }
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      return { ok: false, message: `Cantidad inválida para "${item.productName || item.productId}". Debe ser mayor que cero.` };
    }
    if (!Number.isFinite(item.unitCost) || item.unitCost < 0) {
      return { ok: false, message: `Costo inválido para "${item.productName || item.productId}". No puede ser negativo.` };
    }
    if (seen.has(item.productId)) {
      return { ok: false, message: `El producto "${item.productName || item.productId}" está repetido. Únelo en una sola línea.` };
    }
    seen.add(item.productId);
  }
  return { ok: true, message: '' };
}

// ── Cálculo del stock resultante al recibir (puro) ───────────────────────────
// previousStockMap: { [productId]: stockActualEnServidor }
// Devuelve por línea el stock antes/después; base para la escritura transaccional.
export function computeReceiptStockChanges(items, previousStockMap = {}) {
  return items.map((raw) => {
    const item = normalizeReceiptItem(raw);
    const previousStock = Number(previousStockMap[item.productId] || 0);
    const resultingStock = previousStock + item.quantity;
    return { ...item, previousStock, resultingStock };
  });
}

// ── Cálculo de la reversión al anular (puro) ─────────────────────────────────
// Al anular una recepción se resta lo que se había sumado. Si algún producto ya
// no tiene stock suficiente (porque ya se vendió/entregó), la anulación no puede
// dejar stock negativo: se marca la línea como bloqueante.
export function computeVoidStockChanges(receiptItems, currentStockMap = {}) {
  const changes = receiptItems.map((raw) => {
    const item = normalizeReceiptItem(raw);
    const previousStock = Number(currentStockMap[item.productId] || 0);
    const resultingStock = previousStock - item.quantity;
    return { ...item, previousStock, resultingStock, blocked: resultingStock < 0 };
  });
  const blocked = changes.filter((c) => c.blocked);
  return { changes, blocked };
}

// ── Crear recepción (transacción atómica) ────────────────────────────────────
export async function createGoodsReceipt({ items, supplier = '', reference = '', notes = '', invoicePhoto = null, role } = {}) {
  const user = auth().currentUser;
  if (!user) throw new Error('No autenticado');

  const validation = validateReceptionDraft({ items, supplier, reference });
  if (!validation.ok) throw new Error(validation.message);

  const normItems = items.map(normalizeReceiptItem);
  const productRefs = normItems.map((i) => productsCollection().doc(i.productId));

  const result = await firestore().runTransaction(async (tx) => {
    // TODAS las lecturas antes de cualquier escritura (requisito de Firestore).
    const counterSnap = await tx.get(counterRef());
    const productSnaps = await Promise.all(productRefs.map((ref) => tx.get(ref)));

    // Verificar que cada producto exista y capturar su stock real actual.
    const previousStockMap = {};
    const productMeta = {};
    productSnaps.forEach((snap, idx) => {
      const id = normItems[idx].productId;
      if (!snap.exists()) {
        throw new Error(`El producto "${normItems[idx].productName || id}" ya no existe.`);
      }
      const data = snap.data() || {};
      previousStockMap[id] = Number(data.stock || 0);
      productMeta[id] = {
        name: data.name || normItems[idx].productName || 'Producto',
        category: typeof data.category === 'string' ? data.category.trim() : (normItems[idx].category || ''),
      };
    });

    const lines = computeReceiptStockChanges(normItems, previousStockMap).map((line) => ({
      ...line,
      productName: productMeta[line.productId]?.name || line.productName,
      category: productMeta[line.productId]?.category || line.category,
    }));

    const totals = computeReceiptTotals(lines);
    const nextNumber = Number(counterSnap.data()?.currentNumber || 0) + 1;

    // ── Escrituras ──
    // 1) Incrementar stock de cada producto (solo campos permitidos por reglas).
    lines.forEach((line, idx) => {
      tx.update(productRefs[idx], {
        stock: line.resultingStock,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    });

    // 2) Consecutivo.
    tx.set(counterRef(), { currentNumber: nextNumber }, { merge: true });

    // 3) Documento de recepción (cabecera + líneas).
    const receiptRef = receiptsCollection().doc();
    tx.set(receiptRef, {
      receiptNumber: nextNumber,
      status: RECEIPT_STATUS.COMPLETED,
      supplier: supplier?.trim() || '',
      reference: reference?.trim() || '',
      notes: notes?.trim() || '',
      invoicePhoto: invoicePhoto || null,
      items: lines.map((l) => ({
        productId: l.productId,
        productName: l.productName,
        category: l.category || '',
        quantity: l.quantity,
        unitCost: l.unitCost,
        lineCost: l.lineCost,
        previousStock: l.previousStock,
        resultingStock: l.resultingStock,
      })),
      itemCount: totals.itemCount,
      totalUnits: totals.totalUnits,
      totalCost: totals.totalCost,
      createdBy: user.email || user.uid,
      createdByUid: user.uid,
      createdByRole: role || 'unknown',
      createdAt: firestore.FieldValue.serverTimestamp(),
      voidedBy: null,
      voidedByUid: null,
      voidedAt: null,
      voidReason: null,
    });

    // 4) Feed cronológico plano: una entrada por línea.
    lines.forEach((line) => {
      tx.set(movementsCollection().doc(), {
        type: 'reception',
        receiptId: receiptRef.id,
        receiptNumber: nextNumber,
        productId: line.productId,
        productName: line.productName,
        category: line.category || '',
        quantity: line.quantity,
        unitCost: line.unitCost,
        lineCost: line.lineCost,
        previousStock: line.previousStock,
        resultingStock: line.resultingStock,
        supplier: supplier?.trim() || '',
        createdBy: user.email || user.uid,
        createdByUid: user.uid,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
    });

    return { id: receiptRef.id, receiptNumber: nextNumber, totals };
  });

  return result;
}

// ── Anular recepción (solo admin; revierte stock) ────────────────────────────
// No borra el documento: lo marca 'voided' para conservar la auditoría. Si algún
// producto ya no tiene stock suficiente para revertir, se aborta con detalle.
export async function voidGoodsReceipt({ receiptId, reason = '', role } = {}) {
  const user = auth().currentUser;
  if (!user) throw new Error('No autenticado');
  if (role && role !== 'admin') throw new Error('Solo un administrador puede anular una recepción.');
  if (!reason?.trim()) throw new Error('Indica el motivo de la anulación.');

  const receiptRef = receiptsCollection().doc(receiptId);

  await firestore().runTransaction(async (tx) => {
    const receiptSnap = await tx.get(receiptRef);
    if (!receiptSnap.exists()) throw new Error('La recepción ya no existe.');

    const receipt = receiptSnap.data() || {};
    if (receipt.status === RECEIPT_STATUS.VOIDED) {
      throw new Error('Esta recepción ya fue anulada.');
    }
    if (receipt.status !== RECEIPT_STATUS.COMPLETED) {
      throw new Error('Esta recepción no se puede anular.');
    }

    const receiptItems = (receipt.items || []).filter((i) => i.productId);
    const productRefs = receiptItems.map((i) => productsCollection().doc(i.productId));
    const productSnaps = await Promise.all(productRefs.map((ref) => tx.get(ref)));

    const currentStockMap = {};
    productSnaps.forEach((snap, idx) => {
      const id = receiptItems[idx].productId;
      currentStockMap[id] = snap.exists() ? Number(snap.data()?.stock || 0) : 0;
    });

    const { changes, blocked } = computeVoidStockChanges(receiptItems, currentStockMap);
    if (blocked.length > 0) {
      const names = blocked.map((b) => b.productName || b.productId).join(', ');
      throw new Error(`No se puede anular: el stock de estos productos ya se consumió (${names}).`);
    }

    // Revertir stock donde el producto siga existiendo.
    changes.forEach((line, idx) => {
      if (!productSnaps[idx].exists()) return;
      tx.update(productRefs[idx], {
        stock: line.resultingStock,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    });

    tx.update(receiptRef, {
      status: RECEIPT_STATUS.VOIDED,
      voidedBy: user.email || user.uid,
      voidedByUid: user.uid,
      voidedAt: firestore.FieldValue.serverTimestamp(),
      voidReason: reason.trim(),
    });

    // Movimientos inversos para el feed.
    changes.forEach((line) => {
      if (line.quantity <= 0) return;
      tx.set(movementsCollection().doc(), {
        type: 'reception_void',
        receiptId,
        receiptNumber: receipt.receiptNumber || null,
        productId: line.productId,
        productName: line.productName || '',
        category: line.category || '',
        quantity: line.quantity,
        previousStock: line.previousStock,
        resultingStock: line.resultingStock,
        reason: reason.trim(),
        createdBy: user.email || user.uid,
        createdByUid: user.uid,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });
    });
  });
}

// ── Suscripción en tiempo real a las recepciones (más recientes primero) ─────
export function subscribeGoodsReceipts(callback, { limit = 100 } = {}) {
  return receiptsCollection()
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .onSnapshot(
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        callback(docs);
      },
      (err) => {
        console.error('[receptionService] receipts snapshot:', err);
        callback([]);
      }
    );
}

// ── Una recepción por id ─────────────────────────────────────────────────────
export async function getGoodsReceipt(receiptId) {
  if (!receiptId) return null;
  const snap = await receiptsCollection().doc(receiptId).get();
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ── Feed plano de movimientos de recepción (todas las líneas, cronológico) ────
export function subscribeReceptionMovements(callback, { limit = 200 } = {}) {
  return movementsCollection()
    .where('type', 'in', ['reception', 'reception_void'])
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .onSnapshot(
      (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        callback(docs);
      },
      (err) => {
        console.error('[receptionService] movements snapshot:', err);
        callback([]);
      }
    );
}

export default {
  RECEIPT_STATUS,
  round2,
  normalizeReceiptItem,
  computeReceiptTotals,
  validateReceptionDraft,
  computeReceiptStockChanges,
  computeVoidStockChanges,
  createGoodsReceipt,
  voidGoodsReceipt,
  subscribeGoodsReceipts,
  getGoodsReceipt,
  subscribeReceptionMovements,
};
