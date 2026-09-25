import firestore, { Timestamp } from "@react-native-firebase/firestore";

const col = (name) => firestore().collection(name);
const toTs = (d) => (d instanceof Date ? Timestamp.fromDate(d) : d);

// ─── Caché módulo-nivel ───────────────────────────────────────────────────────
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
const _docsCache    = new Map();
const _summaryCache = new Map();
const _userSalesCache = new Map();
const _creditsByEmployeeCache = new Map();
const _usersCache = new Map();

function _cacheKey(from, to) {
  return `${from?.getTime?.() ?? "null"}_${to?.getTime?.() ?? "null"}`;
}

/**
 * Día calendario LOCAL en formato YYYY-MM-DD.
 *
 * No usar `toISOString().slice(0,10)`: eso convierte a UTC y Nicaragua está en
 * UTC-6, así que toda venta después de las 18:00 se contabilizaba en el día
 * siguiente. Las series diarias salían corridas.
 */
function dayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Fecha de un documento (`createdAt` Timestamp | Date) o null. */
function docDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  return value instanceof Date ? value : null;
}

/** Convierte el acumulado por día en una serie ordenada cronológicamente. */
function buildTimeseries(dailyMap) {
  return Object.entries(dailyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, income: v.income, count: v.count }));
}

/**
 * Pura: agrupa los `financials` tipo 'expense' por categoría y método de pago.
 * Testeable sin Firestore. No recalcula extExpenses — solo lo explica; la
 * suma de `byCategory`/`byPaymentMethod` siempre coincide con `extExpenses`.
 */
export function computeExpenseBreakdown(financialDocs = []) {
  const expenses = financialDocs.filter((f) => f.type === "expense");
  const byCategory = {};
  const byPaymentMethod = {};
  let total = 0;

  expenses.forEach((f) => {
    const amount = Number(f.amount || 0);
    const category = f.category || "OTHER";
    const paymentMethod = f.paymentMethod || "UNKNOWN";
    total += amount;
    byCategory[category] = (byCategory[category] || 0) + amount;
    byPaymentMethod[paymentMethod] = (byPaymentMethod[paymentMethod] || 0) + amount;
  });

  return { total, count: expenses.length, byCategory, byPaymentMethod };
}

/**
 * Pura: arma la lista de usuarios que aparecen como autores de gastos
 * (`financials` tipo 'expense' con `createdByUid`), para alimentar el filtro
 * "por usuario" (FASE E5.1) sin volver a consultar `expenses` ni `users` por
 * cada documento. Deduplicada y ordenada por nombre.
 */
export function computeExpenseUsers(financialDocs = []) {
  const seen = new Map();
  financialDocs
    .filter((f) => f.type === "expense" && f.createdByUid)
    .forEach((f) => {
      if (!seen.has(f.createdByUid)) seen.set(f.createdByUid, f.createdByName || f.createdByUid);
    });
  return Array.from(seen, ([uid, name]) => ({ uid, name })).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Pura: agrupa `reimbursements` en pendientes/pagados — total, cantidad, por
 * empleado y por método. FASE E6.2. NUNCA se suma a `extExpenses`/
 * `computeExpenseBreakdown`: el gasto económico ya está contado una sola vez
 * en `financials` desde la aprobación (FASE E4/E6.2.0 §10-11) — esto es
 * puramente informativo sobre el estado del pago/flujo de caja.
 */
export function computeReimbursementSummary(reimbursementDocs = []) {
  const summary = {
    pendingCount: 0, pendingTotal: 0,
    paidCount: 0, paidTotal: 0,
    byEmployee: {},
    byMethod: {},
  };

  reimbursementDocs.forEach((r) => {
    const amount = Number(r.amount || 0);
    if (r.status === "PENDING") {
      summary.pendingCount += 1;
      summary.pendingTotal += amount;
    } else if (r.status === "PAID") {
      summary.paidCount += 1;
      summary.paidTotal += amount;
      const method = r.paymentMethod || "UNKNOWN";
      summary.byMethod[method] = (summary.byMethod[method] || 0) + amount;
    } else {
      return; // CANCELLED no cuenta ni como pendiente ni como pagado
    }

    const uid = r.createdByUid || "UNKNOWN";
    if (!summary.byEmployee[uid]) {
      summary.byEmployee[uid] = { uid, pendingTotal: 0, paidTotal: 0 };
    }
    if (r.status === "PENDING") summary.byEmployee[uid].pendingTotal += amount;
    if (r.status === "PAID") summary.byEmployee[uid].paidTotal += amount;
  });

  return summary;
}

/**
 * Mapa uid → nombre de todos los usuarios, en una sola consulta cacheada
 * (mismo patrón que el catálogo de `customers`/`products` en getClientsReport/
 * getProductsReport) — nunca un `getDoc` por cada `financials` (FASE E5.1 §7).
 */
async function fetchUsersMap() {
  const hit = _usersCache.get("all");
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.data;

  const snap = await col("users").get();
  const map = {};
  snap.forEach((d) => {
    const u = d.data();
    map[d.id] = `${u.nombre || ""} ${u.apellido || ""}`.trim() || u.user || d.id;
  });

  _usersCache.set("all", { ts: Date.now(), data: map });
  return map;
}

/**
 * Invalida TODAS las cachés del módulo. La usa el pull-to-refresh de la pantalla
 * de reportes: sin esto los datos quedaban congelados hasta 5 minutos (el TTL) y
 * no había forma de forzar una relectura tras registrar una venta.
 *
 * Antes existían dos limpiadores parciales (`clearReportsCache` y
 * `clearFinancialCache`) que nadie llamaba y que además dejaban fuera las cachés
 * de clientes y productos.
 */
export function clearAllReportsCaches() {
  _docsCache.clear();
  _summaryCache.clear();
  _userSalesCache.clear();
  _creditsByEmployeeCache.clear();
  _financialDetailCache.clear();
  _clientsReportCache.clear();
  _productsReportCache.clear();
  _usersCache.clear();
  _reimbursementsCache.clear();
}

// ─── Reporte de reembolsos (FASE E6.2) ────────────────────────────────────────
const _reimbursementsCache = new Map();

/**
 * Trae TODOS los `reimbursements` (catálogo pequeño y acotado — mismo criterio
 * que `getClientsReport`/`getProductsReport`, no un rango de fechas) junto con
 * el nombre de cada empleado (reutiliza `fetchUsersMap`, sin consulta extra
 * por documento) y arma el resumen con `computeReimbursementSummary`.
 */
export async function getReimbursementsSummary() {
  const hit = _reimbursementsCache.get("all");
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.data;

  try {
    const [snap, usersMap] = await Promise.all([
      col("reimbursements").get(),
      fetchUsersMap().catch(() => ({})),
    ]);

    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const summary = computeReimbursementSummary(docs);
    Object.values(summary.byEmployee).forEach((e) => {
      e.name = usersMap[e.uid] || e.uid;
    });

    _reimbursementsCache.set("all", { ts: Date.now(), data: summary });
    return summary;
  } catch (e) {
    console.error("ERROR getReimbursementsSummary:", e);
    return null;
  }
}

const extractProductId = (it) =>
  it.id || it.productId || it.product?.productId || it.product?.id || null;

/** Costo de una línea al momento de la venta, si quedó denormalizado en el documento.
 *  Exportado para poder probar la preferencia costo-guardado vs catálogo. */
export const lineCost = (it) => {
  const stored = Number(it.purchasePrice);
  return Number.isFinite(stored) && stored > 0 ? stored : null;
};

/**
 * Precios de compra por id de producto, SOLO para los ids que no traen el costo
 * en la propia línea (documentos anteriores a que se denormalizara).
 *
 * El `in` de Firestore admite 10 valores, así que hay que trocear. Los trozos son
 * independientes: van en paralelo con Promise.all. Antes esto era un `await` dentro
 * de un `for`, o sea N/10 viajes en serie — con 200 productos, 20 idas y vueltas
 * encadenadas antes de poder pintar el reporte.
 */
async function fetchPurchasePrices(productIds) {
  const ids = Array.from(productIds);
  if (!ids.length) return {};

  const chunks = [];
  for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));

  const snapshots = await Promise.all(
    chunks.map((chunk) =>
      col("products").where(firestore.FieldPath.documentId(), "in", chunk).get()
    )
  );

  const prices = {};
  snapshots.forEach((snap) => {
    snap.forEach((d) => { prices[d.id] = d.data().purchasePrice || 0; });
  });
  return prices;
}

// Estados de pre-venta que representan una venta completada/activa.
// Array y no Set: se pasa directo al `where(..., "in", ...)` de los queries.
const COMPLETED_PRESALE_STATUSES = [
  "paid",
  "delivered",
  "credit_pending",
  "credit_preparing",
  "credit_ready_for_delivery",
  "credit_dispatched",
];

/**
 * Normaliza un documento de `presales` al mismo formato que usa `sales`,
 * para que los reportes puedan tratar ambas fuentes uniformemente.
 */
function normalizePresale(data) {
  return {
    ...data,
    // empleado: presales usa createdBy
    cashierEmail: data.createdBy || null,
    cashierName: data.createdBy || null,
    // items: presales ya tiene el array items
    items: Array.isArray(data.items) ? data.items : [],
    _source: "presale",
  };
}

/**
 * Obtiene documentos de `sales` Y de `presales` completadas en un rango de fechas.
 * Devuelve un array plano de objetos de datos normalizados.
 */
async function fetchAllSalesDocs({ from, to }) {
  const key = _cacheKey(from, to);
  const hit = _docsCache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.data;

  const queries = [];

  // --- ventas rápidas ---
  let qSales = col("sales").orderBy("createdAt");
  if (from) qSales = qSales.where("createdAt", ">=", toTs(from));
  if (to)   qSales = qSales.where("createdAt", "<=", toTs(to));
  queries.push(qSales.get());

  // --- pre-ventas: el status va en el query. Antes se traía TODA la pre-venta del
  // rango (canceladas, pendientes, en preparación) para descartarla en memoria. ---
  let qPresales = col("presales")
    .where("status", "in", COMPLETED_PRESALE_STATUSES)
    .orderBy("createdAt");
  if (from) qPresales = qPresales.where("createdAt", ">=", toTs(from));
  if (to)   qPresales = qPresales.where("createdAt", "<=", toTs(to));
  queries.push(qPresales.get());

  const [salesSnap, presalesSnap] = await Promise.all(queries);

  const allDocs = [];

  salesSnap.forEach((doc) => {
    allDocs.push({ _id: doc.id, ...doc.data(), _source: "sale" });
  });

  presalesSnap.forEach((doc) => {
    allDocs.push({ _id: doc.id, ...normalizePresale(doc.data()) });
  });

  _docsCache.set(key, { ts: Date.now(), data: allDocs });
  return allDocs;
}

/**
 * Créditos creados en el rango, agrupados por vendedor (`createdBy`).
 * La usa `getSalesSummaryOptimized` para enriquecer `salesByEmployee` con el
 * detalle de crédito del panel de Vendedores — sin esto ese panel solo veía
 * el total de venta, sin distinguir cuánto quedó pendiente vs cobrado.
 *
 * `creditPaid`/`creditPending` replican exactamente el criterio de
 * `getCreditTotals` (creditsService.js): `total` para créditos con
 * status 'paid', `pending` para 'pending' — mismo número que vería el
 * vendedor en el módulo Créditos.
 *
 * `collectedToDate` es distinto de `creditPaid`: suma los abonos
 * (`payments[]`) con fecha dentro de [`from`, `to`], sin importar el status
 * actual del crédito NI cuándo se originó — una venta a crédito de un mes
 * puede cobrarse el siguiente, y ese abono sí cuenta como cobrado en este
 * período aunque el crédito no aparezca como "creado" en él. Por eso la
 * consulta solo acota por `createdAt <= to` (no por `from`): filtrar también
 * por `from` en la consulta dejaba fuera créditos originados antes del rango
 * y subestimaba lo realmente cobrado.
 */
async function fetchCreditsByEmployee({ from, to }) {
  const key = _cacheKey(from, to);
  const hit = _creditsByEmployeeCache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.data;

  const byEmployee = {};
  try {
    let q = col("credits").orderBy("createdAt");
    if (to) q = q.where("createdAt", "<=", toTs(to));
    const snap = await q.get();
    const toMs = to instanceof Date ? to.getTime() : null;
    const fromMs = from instanceof Date ? from.getTime() : null;

    snap.forEach((doc) => {
      const c = doc.data();
      const empKey = c.createdBy || null;
      if (!empKey) return;

      if (!byEmployee[empKey]) {
        byEmployee[empKey] = {
          creditPending: 0, creditPendingCount: 0,
          creditPaid: 0, creditPaidCount: 0,
          collectedToDate: 0,
        };
      }
      const bucket = byEmployee[empKey];

      // creditPending/creditPaid describen créditos ORIGINADOS en el rango.
      const createdMs = docDate(c.createdAt)?.getTime() ?? null;
      const createdInRange = fromMs === null || (createdMs !== null && createdMs >= fromMs);
      if (createdInRange) {
        if (c.status === "paid") {
          bucket.creditPaid += Number(c.total) || 0;
          bucket.creditPaidCount += 1;
        } else if (c.status === "pending") {
          bucket.creditPending += Number(c.pending) || 0;
          bucket.creditPendingCount += 1;
        }
      }

      (c.payments || []).forEach((p) => {
        const d = docDate(p.date);
        if (!d) return;
        const ms = d.getTime();
        if ((toMs === null || ms <= toMs) && (fromMs === null || ms >= fromMs)) {
          bucket.collectedToDate += Number(p.amount) || 0;
        }
      });
    });
  } catch (e) {
    // Un fallo aquí no debe tumbar el resto del resumen: el panel de Vendedores
    // simplemente se queda sin el detalle de crédito (campos en 0/undefined).
    console.error("ERROR fetchCreditsByEmployee:", e);
  }

  _creditsByEmployeeCache.set(key, { ts: Date.now(), data: byEmployee });
  return byEmployee;
}

export async function getSalesSummaryOptimized({ from, to, topN = 10 }) {
  const key = _cacheKey(from, to);
  const hit = _summaryCache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.data;

  try {
    const allDocs = await fetchAllSalesDocs({ from, to });

    if (!allDocs.length) {
      const empty = {
        totalIncome: 0, totalCost: 0, profit: 0, avgPerSale: 0,
        totalSalesCount: 0, topProducts: [], timeseries: [],
        salesByEmployee: [], bestClients: [],
        totalDiscounts: 0,
      };
      // También se cachea el vacío: si no, un rango sin ventas repetía las dos
      // consultas cada vez que se entraba a la pestaña.
      _summaryCache.set(key, { ts: Date.now(), data: empty });
      return empty;
    }

    // Recopilar IDs de productos
    const productIds = new Set();
    allDocs.forEach((sale) => {
      (sale.items || []).forEach((it) => {
        const pid = extractProductId(it);
        // Solo se consulta el catálogo si la línea no guardó su costo.
        if (pid && lineCost(it) === null) productIds.add(pid);
      });
    });

    // Precios de compra + créditos por vendedor del mismo rango, en paralelo
    // (consultas independientes, no hace falta encadenarlas).
    const [productPrices, creditsByEmployee] = await Promise.all([
      fetchPurchasePrices(productIds),
      fetchCreditsByEmployee({ from, to }),
    ]);

    let totalIncome = 0;
    let totalCost = 0;
    let totalDiscounts = 0;
    const productCount = {};
    const employeeTotals = {};
    const clientTotals = {};
    const dailySales = {};

    allDocs.forEach((sale) => {
      const saleTotal = Number(sale.total ?? sale.subtotal ?? 0);
      totalIncome += saleTotal;

      // Serie diaria: la consume la gráfica del panel de Ventas. Antes el resumen
      // no la devolvía, así que la gráfica y los KPIs de ese panel —que se
      // mostraban solo si había serie— no llegaban a pintarse nunca.
      const ts = docDate(sale.createdAt);
      if (ts) {
        const day = dayKey(ts);
        if (!dailySales[day]) dailySales[day] = { income: 0, count: 0 };
        dailySales[day].income += saleTotal;
        dailySales[day].count += 1;
      }

      // Empleado: ventas rápidas usan soldBy/cashierEmail, presales usan createdBy
      const empKey =
        sale.createdBy || sale.soldBy || sale.cashierEmail || sale.cashierName || null;
      if (empKey) {
        if (!employeeTotals[empKey]) {
          employeeTotals[empKey] = {
            id: empKey,
            name: sale.cashierName || sale.soldBy || empKey,
            total: 0, count: 0, cash: 0,
          };
        }
        employeeTotals[empKey].total += saleTotal;
        employeeTotals[empKey].count += 1;
        // Efectivo de ventas pagadas: las de crédito quedan con paymentMethod
        // 'credit' (ver savePreSaleToFirestore/PaymentSelector), así que este
        // filtro ya las excluye sin tocar el resto del cómputo.
        const pm = (sale.paymentMethod || sale.payment_method || "").toLowerCase().trim();
        if (pm === "cash" || pm === "efectivo") employeeTotals[empKey].cash += saleTotal;
      }

      // Cliente
      const clientKey = sale.customerId || sale.customerName || null;
      if (clientKey) {
        if (!clientTotals[clientKey]) {
          clientTotals[clientKey] = {
            customerId: clientKey,
            name: sale.customerName || clientKey,
            total: 0, count: 0,
          };
        }
        clientTotals[clientKey].total += saleTotal;
        clientTotals[clientKey].count += 1;
      }

      // Items
      let saleCost = 0;
      (sale.items || []).forEach((it) => {
        const qty = Number(it.quantity ?? it.qty ?? 0);
        const pid = extractProductId(it);
        if (pid && qty > 0) {
          if (!productCount[pid]) {
            productCount[pid] = { productId: pid, qty: 0, total: 0 };
          }
          productCount[pid].qty += qty;
          productCount[pid].total += Number(it.total || 0);
          saleCost += (lineCost(it) ?? productPrices[pid] ?? 0) * qty;
        }
        totalDiscounts += Number(it.discount || 0) + Number(it.autoDiscountTotal || 0);
      });
      totalCost += saleCost;
    });

    // Fusiona el detalle de crédito de cada vendedor. Un vendedor puede tener
    // créditos en el rango sin ventas propias que lo hayan creado en employeeTotals
    // todavía (p. ej. solo créditos, ninguna venta de contado) — se crea el bucket.
    Object.entries(creditsByEmployee).forEach(([empKey, credit]) => {
      if (!employeeTotals[empKey]) {
        employeeTotals[empKey] = { id: empKey, name: empKey, total: 0, count: 0, cash: 0 };
      }
      Object.assign(employeeTotals[empKey], credit);
    });

    const result = {
      totalIncome,
      totalCost,
      profit: totalIncome - totalCost,
      avgPerSale: totalIncome / Math.max(allDocs.length, 1),
      totalSalesCount: allDocs.length,
      // `totalDiscounts` es lo que el cliente ahorró. Antes se devolvía dos veces
      // con nombres distintos (`totalSaved`), calculado con la misma expresión.
      totalDiscounts: Number(totalDiscounts.toFixed(2)),
      timeseries: buildTimeseries(dailySales),
      topProducts: Object.values(productCount)
        .sort((a, b) => b.qty - a.qty)
        .slice(0, topN),
      salesByEmployee: Object.values(employeeTotals)
        .sort((a, b) => b.total - a.total),
      bestClients: Object.values(clientTotals)
        .sort((a, b) => b.total - a.total)
        .slice(0, topN),
    };
    _summaryCache.set(key, { ts: Date.now(), data: result });
    return result;
  } catch (e) {
    console.error("ERROR getSalesSummaryOptimized:", e);
    return null;
  }
}

/**
 * Reporte financiero detallado: ventas + financials externos + métodos de pago + timeseries diaria.
 * Aprovecha la caché de fetchAllSalesDocs para no repetir queries.
 */
const _financialDetailCache = new Map();

export async function getFinancialDetail({ from, to }) {
  const key = `fin_${_cacheKey(from, to)}`;
  const hit = _financialDetailCache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.data;

  try {
    // Fetch sales (cached) + financials + usuarios (cached) en paralelo
    const [allDocs, finSnap, usersMap] = await Promise.all([
      fetchAllSalesDocs({ from, to }),
      (() => {
        let q = col("financials").orderBy("createdAt", "desc");
        if (from) q = q.where("createdAt", ">=", toTs(from));
        if (to)   q = q.where("createdAt", "<=", toTs(to));
        return q.get().catch(() => ({ forEach: () => {} }));
      })(),
      fetchUsersMap().catch(() => ({})),
    ]);

    // Precios de compra para calcular costo de mercancía
    const productIds = new Set();
    allDocs.forEach((sale) => {
      (sale.items || []).forEach((it) => {
        const pid = extractProductId(it);
        // Solo se consulta el catálogo si la línea no guardó su costo.
        if (pid && lineCost(it) === null) productIds.add(pid);
      });
    });
    const productPrices = await fetchPurchasePrices(productIds);

    // Métricas de ventas
    let salesIncome = 0, salesCost = 0, totalDiscounts = 0;
    const paymentMethods = {};
    const dailySales = {};
    const salesSources = { sale: 0, presale: 0 };

    allDocs.forEach((sale) => {
      const saleTotal = Number(sale.total ?? sale.subtotal ?? 0);
      salesIncome += saleTotal;

      // Fuente
      if (sale._source === "presale") salesSources.presale += saleTotal;
      else salesSources.sale += saleTotal;

      // Método de pago
      const pm = (sale.paymentMethod || sale.payment_method || "efectivo")
        .toLowerCase().trim();
      if (!paymentMethods[pm]) paymentMethods[pm] = { label: pm, total: 0, count: 0 };
      paymentMethods[pm].total += saleTotal;
      paymentMethods[pm].count += 1;

      // Serie diaria, agrupada por día LOCAL (ver dayKey).
      const ts = docDate(sale.createdAt);
      if (ts) {
        const day = dayKey(ts);
        if (!dailySales[day]) dailySales[day] = { income: 0, count: 0 };
        dailySales[day].income += saleTotal;
        dailySales[day].count  += 1;
      }

      // Costo y descuentos por ítem
      let saleCost = 0;
      (sale.items || []).forEach((it) => {
        const qty = Number(it.quantity ?? it.qty ?? 0);
        const pid = extractProductId(it);
        if (pid && qty > 0)
          saleCost += (lineCost(it) ?? productPrices[pid] ?? 0) * qty;
        totalDiscounts +=
          Number(it.discount || 0) + Number(it.autoDiscountTotal || 0);
      });
      salesCost += saleCost;
    });

    // Financials externos (colección `financials`)
    let extIncomes = 0, extExpenses = 0;
    const financialDocs = [];
    finSnap.forEach((doc) => {
      const f = { id: doc.id, ...doc.data() };
      // Nombre resuelto vía el mapa ya cargado — nunca una consulta por doc
      // (FASE E5.1). Financials históricos sin createdByUid (previos a E5.1)
      // quedan explícitamente como "Usuario no disponible", nunca se infiere.
      f.createdByName = f.createdByUid ? (usersMap[f.createdByUid] || "Usuario no disponible") : null;
      financialDocs.push(f);
      const amount = Number(f.amount || 0);
      if (f.type === "income")  extIncomes  += amount;
      if (f.type === "expense") extExpenses += amount;
    });

    // Desglose de gastos operativos (FASE E5) — solo agrupa lo que ya se sumó
    // arriba en extExpenses; no cambia esa cifra, solo la explica por
    // categoría/método. `financialDocs` ya trae category/paymentMethod desde
    // FASE E4 (el mirror los escribe); un financial externo/manual sin esos
    // campos simplemente cae en "OTHER"/"UNKNOWN".
    const expenseBreakdown = computeExpenseBreakdown(financialDocs);
    // Lista de usuarios para el filtro (FASE E5.1) — solo autores reales de
    // gastos, deducida de los mismos financialDocs ya traídos.
    const expenseUsers = computeExpenseUsers(financialDocs);

    // Timeseries ordenada por fecha
    const timeseries = buildTimeseries(dailySales);

    const grossProfit = salesIncome - salesCost;
    const netProfit   = grossProfit + extIncomes - extExpenses;

    const result = {
      // Ventas
      salesIncome,
      salesCost,
      grossProfit,
      grossMargin:   salesIncome > 0 ? (grossProfit / salesIncome) * 100 : 0,
      netMargin:     salesIncome > 0 ? (netProfit   / salesIncome) * 100 : 0,
      totalDiscounts: Number(totalDiscounts.toFixed(2)),
      salesCount:    allDocs.length,
      avgPerSale:    salesIncome / Math.max(allDocs.length, 1),
      salesSources,
      paymentMethods: Object.values(paymentMethods).sort((a, b) => b.total - a.total),
      timeseries,
      // Financials externos
      extIncomes,
      extExpenses,
      financialDocs,
      expenseBreakdown,
      expenseUsers,
      // Totales consolidados
      totalIncome:   salesIncome + extIncomes,
      totalExpenses: salesCost   + extExpenses,
      netProfit,
    };

    _financialDetailCache.set(key, { ts: Date.now(), data: result });
    return result;
  } catch (e) {
    console.error("ERROR getFinancialDetail:", e);
    return null;
  }
}

/** Usuarios del sistema, en vivo, para el panel de monitoreo. */
export function subscribeUsersActivity(callback) {
  return col("users").onSnapshot(
    (snap) => {
      const users = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
      callback(users);
    },
    (e) => {
      console.log("ERROR subscribeUsersActivity:", e);
      callback([]);
    }
  );
}

/** Obtiene ventas agrupadas por usuario en un rango de fechas (sales + presales) */
export async function getSalesByUserInRange({ from, to }) {
  const key = _cacheKey(from, to);
  const hit = _userSalesCache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.data;

  try {
    const allDocs = await fetchAllSalesDocs({ from, to });
    const map = {};
    allDocs.forEach((s) => {
      const key2 = s.createdBy || s.soldBy || s.cashierEmail || "—";
      if (!map[key2]) {
        map[key2] = { userKey: key2, total: 0, count: 0, lastSale: null };
      }
      map[key2].total += Number(s.total ?? 0);
      map[key2].count += 1;
      const ts = s.createdAt?.toDate ? s.createdAt.toDate() : null;
      if (ts && (!map[key2].lastSale || ts > map[key2].lastSale)) {
        map[key2].lastSale = ts;
      }
    });
    _userSalesCache.set(key, { ts: Date.now(), data: map });
    return map;
  } catch (e) {
    return {};
  }
}

/**
 * Consulta dedicada para el panel de ventas:
 * obtiene únicamente documentos de `sales` y `presales` completadas,
 * con paginación independiente por colección.
 * Cada colección tiene su propio try/catch para que un fallo no afecte a la otra.
 */
export async function getSalesPage({ cursors = {}, from, to, limit = 20 }) {
  const results = [];
  let newCursors = { ...cursors };

  const collections = [
    { col: "sales",    kind: "sale"    },
    { col: "presales", kind: "presale" },
  ];

  for (const c of collections) {
    try {
      // El status va ANTES del limit. Filtrarlo después significaba que una página
      // de 10 podía devolver 2 filas útiles, y el consumidor lo interpretaba como
      // "se acabaron los datos" (useReportsData mira el largo para decidir hasMore).
      let q = col(c.col);
      if (c.col === "presales") {
        q = q.where("status", "in", COMPLETED_PRESALE_STATUSES);
      }
      q = q.orderBy("createdAt", "desc");
      if (from) q = q.where("createdAt", ">=", toTs(from));
      if (to)   q = q.where("createdAt", "<=", toTs(to));
      if (cursors[c.col]) q = q.startAfter(cursors[c.col]);
      q = q.limit(limit);

      const snap = await q.get();
      if (!snap.empty) {
        newCursors[c.col] = snap.docs[snap.docs.length - 1];
        snap.docs.forEach((doc) => {
          const data = doc.data();
          results.push({
            id: doc.id,
            ...data,
            __kind: c.kind,
            _uid: `${c.kind}_${doc.id}`,
          });
        });
      }
    } catch (e) {
      // Un fallo en una colección no bloquea la otra
      console.error(`ERROR getSalesPage [${c.col}]:`, e);
    }
  }

  results.sort(
    (a, b) =>
      (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)
  );

  return { items: results, cursors: newCursors };
}

// ─── Caché de reporte de clientes ────────────────────────────────────────────
const _clientsReportCache = new Map();

/**
 * Reporte completo de clientes:
 *   - Fusiona la colección `customers` con las ventas del período
 *   - Calcula: total gastado, # transacciones, última compra, productos más comprados
 *   - Identifica clientes nuevos en el período (createdAt dentro del rango)
 *   - Agrupa por tipo (Común / Semi-mayorista / Mayorista)
 */
export async function getClientsReport({ from, to }) {
  const key = `cli_${_cacheKey(from, to)}`;
  const hit = _clientsReportCache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.data;

  try {
    // Ventas cacheadas + catálogo completo de clientes en paralelo
    const [allDocs, customersSnap] = await Promise.all([
      fetchAllSalesDocs({ from, to }),
      col("customers").orderBy("firstName").get(),
    ]);

    // Mapa de clientes del catálogo
    const catalog = {};
    customersSnap.forEach((d) => {
      const data = d.data();
      catalog[d.id] = {
        id: d.id,
        firstName:   data.firstName   || "",
        lastName:    data.lastName    || "",
        name:        `${data.firstName || ""} ${data.lastName || ""}`.trim() || "Sin nombre",
        phone:       data.phone       || "",
        cedula:      data.cedula      || "",
        address:     data.address     || "",
        creditLimit: Number(data.creditLimit || 0),
        type:        data.type        || "Común",
        discount:    Number(data.discount || 0),
        createdAt:   data.createdAt   || null,
      };
    });

    // Acumular ventas por cliente
    const salesMap = {}; // customerId → { total, count, lastDate, products }

    allDocs.forEach((sale) => {
      const cid   = sale.customerId || null;
      const cName = sale.customerName || null;
      // Clave: ID de cliente si existe, si no el nombre
      const key2  = cid || cName || null;
      if (!key2) return;

      if (!salesMap[key2]) {
        salesMap[key2] = {
          customerId:   cid,
          customerName: cName,
          total:        0,
          count:        0,
          lastDate:     null,
          itemsQty:     0,
        };
      }
      salesMap[key2].total    += Number(sale.total ?? sale.subtotal ?? 0);
      salesMap[key2].count    += 1;
      salesMap[key2].itemsQty += (sale.items || []).reduce((s, it) => s + Number(it.quantity ?? it.qty ?? 0), 0);
      const ts = sale.createdAt?.toDate ? sale.createdAt.toDate() : null;
      if (ts && (!salesMap[key2].lastDate || ts > salesMap[key2].lastDate)) {
        salesMap[key2].lastDate = ts;
      }
    });

    // Período para detectar clientes nuevos
    const fromTs = from ? from.getTime() : 0;
    const toTs2  = to   ? to.getTime()   : Date.now();

    // Enriquecer clientes del catálogo con sus ventas
    const enriched = Object.values(catalog).map((c) => {
      const s  = salesMap[c.id] || salesMap[c.name] || {};
      const cat = c.createdAt?.toDate ? c.createdAt.toDate() : (c.createdAt instanceof Date ? c.createdAt : null);
      const isNew = cat && cat.getTime() >= fromTs && cat.getTime() <= toTs2;
      return {
        ...c,
        total:    s.total    || 0,
        count:    s.count    || 0,
        lastDate: s.lastDate || null,
        itemsQty: s.itemsQty || 0,
        avgTicket:s.count ? (s.total / s.count) : 0,
        isActive: (s.count || 0) > 0,
        isNew,
      };
    });

    // Ventas que no corresponden a ningún cliente del catálogo: o se registraron
    // con nombre libre (sin `customerId`), o el cliente se eliminó después. En
    // ambos casos no aparecen en la lista de clientes y su importe se perdía de
    // vista. Antes el filtro exigía `customerId`, así que las de nombre libre
    // —justamente las que el contador dice medir— nunca se contaban.
    const anonymousSales = Object.values(salesMap).filter(
      (s) => !s.customerId || !catalog[s.customerId]
    );

    // Agrupación por tipo
    const byType = {};
    enriched.forEach((c) => {
      const t = c.type || "Común";
      if (!byType[t]) byType[t] = { type: t, count: 0, total: 0, activeCount: 0 };
      byType[t].count       += 1;
      byType[t].total       += c.total;
      byType[t].activeCount += c.isActive ? 1 : 0;
    });

    const totalRevenue  = enriched.reduce((s, c) => s + c.total, 0);
    const activeClients = enriched.filter((c) => c.isActive);
    const newClients    = enriched.filter((c) => c.isNew);
    const topClients    = [...enriched].filter((c) => c.total > 0).sort((a, b) => b.total - a.total);

    const result = {
      totalClients:  enriched.length,
      activeCount:   activeClients.length,
      newCount:      newClients.length,
      totalRevenue,
      avgTicket:     activeClients.length ? totalRevenue / activeClients.reduce((s, c) => s + c.count, 0) : 0,
      topClients,
      allClients:    [...enriched].sort((a, b) => b.total - a.total),
      newClients,
      byType:        Object.values(byType).sort((a, b) => b.total - a.total),
      anonymousCount: anonymousSales.length,
    };

    _clientsReportCache.set(key, { ts: Date.now(), data: result });
    return result;
  } catch (e) {
    console.error("ERROR getClientsReport:", e);
    return null;
  }
}

// ─── Caché de reporte de productos ───────────────────────────────────────────
const _productsReportCache = new Map();

/**
 * Reporte completo de productos:
 *   - Top por cantidad vendida y por ingresos (del período)
 *   - Inventario actual (stock, costo, precio) de todos los productos
 *   - Desglose por categoría (ventas + stock)
 *   - Alertas de stock bajo
 *
 * Aprovecha fetchAllSalesDocs (ya cacheada) + una query única a `products`.
 */
export async function getProductsReport({ from, to, lowStockThreshold = 10 }) {
  const key = `prod_${_cacheKey(from, to)}`;
  const hit = _productsReportCache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.data;

  try {
    // 1. Ventas del período (cacheadas) + todos los productos (catálogo completo)
    const [allDocs, productsSnap] = await Promise.all([
      fetchAllSalesDocs({ from, to }),
      col("products").orderBy("name").get(),
    ]);

    // 2. Mapa de productos (catálogo completo)
    const catalog = {};
    productsSnap.forEach((d) => {
      catalog[d.id] = { id: d.id, ...d.data() };
    });

    // 3. Acumular métricas de ventas por producto
    const salesMap = {}; // productId → { qty, revenue, discounts, salesCount }

    allDocs.forEach((sale) => {
      (sale.items || []).forEach((it) => {
        const pid = extractProductId(it);
        if (!pid) return;
        const qty      = Number(it.quantity ?? it.qty ?? 0);
        const revenue  = Number(it.total || 0);
        const discount = Number(it.discount || 0) + Number(it.autoDiscountTotal || 0);

        if (!salesMap[pid]) salesMap[pid] = { qty: 0, revenue: 0, discounts: 0, salesCount: 0 };
        salesMap[pid].qty        += qty;
        salesMap[pid].revenue    += revenue;
        salesMap[pid].discounts  += discount;
        salesMap[pid].salesCount += 1;
      });
    });

    // 4. Fusionar catálogo + ventas
    const enriched = Object.values(catalog).map((p) => {
      const s = salesMap[p.id] || { qty: 0, revenue: 0, discounts: 0, salesCount: 0 };
      const cost        = Number(p.purchasePrice || 0);
      const salePrice   = Number(p.salePrice || p.price || 0);
      const stock       = Number(p.stock ?? 0);
      const grossProfit = s.revenue - cost * s.qty;
      const margin      = s.revenue > 0 ? (grossProfit / s.revenue) * 100 : 0;
      return {
        ...p,
        qtySold:    s.qty,
        revenue:    s.revenue,
        discounts:  s.discounts,
        grossProfit,
        margin,
        cost,
        salePrice,
        stock,
        stockValue: cost * stock,
        isLowStock: stock > 0 && stock <= lowStockThreshold,
        isOutOfStock: stock <= 0,
      };
    });

    // 5. Agrupar por categoría
    const categoryMap = {};
    enriched.forEach((p) => {
      const cat = p.category || "Sin categoría";
      if (!categoryMap[cat]) categoryMap[cat] = { name: cat, count: 0, revenue: 0, qty: 0, stockValue: 0 };
      categoryMap[cat].count    += 1;
      categoryMap[cat].revenue  += p.revenue;
      categoryMap[cat].qty      += p.qtySold;
      categoryMap[cat].stockValue += p.stockValue;
    });

    // 6. Totales globales
    const totalRevenue = enriched.reduce((s, p) => s + p.revenue, 0);
    const totalQtySold = enriched.reduce((s, p) => s + p.qtySold, 0);
    const totalStockValue = enriched.reduce((s, p) => s + p.stockValue, 0);
    const lowStockList  = enriched.filter((p) => p.isLowStock).sort((a, b) => a.stock - b.stock);
    const outOfStockList = enriched.filter((p) => p.isOutOfStock);

    const result = {
      totalProducts:  enriched.length,
      totalRevenue,
      totalQtySold,
      totalStockValue,
      lowStockCount:   lowStockList.length,
      outOfStockCount: outOfStockList.length,
      topBySales:  [...enriched].sort((a, b) => b.qtySold - a.qtySold).filter((p) => p.qtySold > 0),
      topByRevenue:[...enriched].sort((a, b) => b.revenue - a.revenue).filter((p) => p.revenue > 0),
      allProducts: enriched,
      lowStock:    lowStockList,
      outOfStock:  outOfStockList,
      categories:  Object.values(categoryMap).sort((a, b) => b.revenue - a.revenue),
    };

    _productsReportCache.set(key, { ts: Date.now(), data: result });
    return result;
  } catch (e) {
    console.error("ERROR getProductsReport:", e);
    return null;
  }
}

