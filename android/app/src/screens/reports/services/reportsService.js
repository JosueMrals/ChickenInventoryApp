import firestore, { Timestamp } from "@react-native-firebase/firestore";

const col = (name) => firestore().collection(name);
const toTs = (d) => (d instanceof Date ? Timestamp.fromDate(d) : d);

// ─── Caché módulo-nivel ───────────────────────────────────────────────────────
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos
const _docsCache    = new Map();
const _summaryCache = new Map();
const _userSalesCache = new Map();

function _cacheKey(from, to) {
  return `${from?.getTime?.() ?? "null"}_${to?.getTime?.() ?? "null"}`;
}

/** Invalida todas las cachés (llamar cuando se genera una nueva venta) */
export function clearReportsCache() {
  _docsCache.clear();
  _summaryCache.clear();
  _userSalesCache.clear();
}

const extractProductId = (it) =>
  it.id || it.productId || it.product?.productId || it.product?.id || null;

// Estados de pre-venta que representan una venta completada/activa
const COMPLETED_PRESALE_STATUSES = new Set([
  "paid",
  "delivered",
  "credit_pending",
  "credit_preparing",
  "credit_ready_for_delivery",
]);

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

  // --- pre-ventas: se consulta por rango de fecha y se filtra el status en memoria ---
  let qPresales = col("presales").orderBy("createdAt");
  if (from) qPresales = qPresales.where("createdAt", ">=", toTs(from));
  if (to)   qPresales = qPresales.where("createdAt", "<=", toTs(to));
  queries.push(qPresales.get());

  const [salesSnap, presalesSnap] = await Promise.all(queries);

  const allDocs = [];

  salesSnap.forEach((doc) => {
    allDocs.push({ _id: doc.id, ...doc.data(), _source: "sale" });
  });

  presalesSnap.forEach((doc) => {
    const data = doc.data();
    if (COMPLETED_PRESALE_STATUSES.has(data.status)) {
      allDocs.push({ _id: doc.id, ...normalizePresale(data) });
    }
  });

  _docsCache.set(key, { ts: Date.now(), data: allDocs });
  return allDocs;
}

export async function getSalesSummaryOptimized({ from, to, topN = 10 }) {
  const key = _cacheKey(from, to);
  const hit = _summaryCache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.data;

  try {
    const allDocs = await fetchAllSalesDocs({ from, to });

    if (!allDocs.length) {
      return {
        totalIncome: 0, totalCost: 0, profit: 0, avgPerSale: 0,
        totalSalesCount: 0, topProducts: [], timeseries: [],
        salesByEmployee: [], bestClients: [],
        totalDiscounts: 0, totalSaved: 0,
      };
    }

    // Recopilar IDs de productos
    const productIds = new Set();
    allDocs.forEach((sale) => {
      (sale.items || []).forEach((it) => {
        const pid = extractProductId(it);
        if (pid) productIds.add(pid);
      });
    });

    // Precios de compra
    const productPrices = {};
    if (productIds.size > 0) {
      const arr = Array.from(productIds);
      const chunks = [];
      for (let i = 0; i < arr.length; i += 10) chunks.push(arr.slice(i, i + 10));
      for (const ch of chunks) {
        const pdocs = await col("products")
          .where(firestore.FieldPath.documentId(), "in", ch)
          .get();
        pdocs.forEach((d) => { productPrices[d.id] = d.data().purchasePrice || 0; });
      }
    }

    let totalIncome = 0;
    let totalCost = 0;
    let totalDiscounts = 0;
    let totalSaved = 0;
    const productCount = {};
    const employeeTotals = {};
    const clientTotals = {};

    allDocs.forEach((sale) => {
      const saleTotal = Number(sale.total ?? sale.subtotal ?? 0);
      totalIncome += saleTotal;

      // Empleado: ventas rápidas usan soldBy/cashierEmail, presales usan createdBy
      const empKey =
        sale.createdBy || sale.soldBy || sale.cashierEmail || sale.cashierName || null;
      if (empKey) {
        if (!employeeTotals[empKey]) {
          employeeTotals[empKey] = {
            id: empKey,
            name: sale.cashierName || sale.soldBy || empKey,
            total: 0, count: 0,
          };
        }
        employeeTotals[empKey].total += saleTotal;
        employeeTotals[empKey].count += 1;
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
          saleCost += (productPrices[pid] || 0) * qty;
        }
        totalDiscounts += Number(it.discount || 0) + Number(it.autoDiscountTotal || 0);
        totalSaved     += Number(it.discount || 0) + Number(it.autoDiscountTotal || 0);
      });
      totalCost += saleCost;
    });

    const result = {
      totalIncome,
      totalCost,
      profit: totalIncome - totalCost,
      avgPerSale: totalIncome / Math.max(allDocs.length, 1),
      totalSalesCount: allDocs.length,
      totalDiscounts: Number(totalDiscounts.toFixed(2)),
      totalSaved: Number(totalSaved.toFixed(2)),
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

export async function getSalesByEmployee({ from, to }) {
  try {
    const allDocs = await fetchAllSalesDocs({ from, to });
    const map = {};
    allDocs.forEach((s) => {
      const key =
        s.createdBy || s.soldBy || s.cashierEmail || s.cashierName || "Desconocido";
      if (!map[key]) {
        map[key] = { id: key, name: s.cashierName || s.soldBy || key, total: 0, count: 0 };
      }
      map[key].total += Number(s.total ?? 0);
      map[key].count += 1;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  } catch (e) {
    console.log("ERROR getSalesByEmployee:", e);
    return [];
  }
}

export async function getFinancialSummary({ from, to }) {
  try {
    let q = col("financials").orderBy("createdAt");
    if (from) q = q.where("createdAt", ">=", toTs(from));
    if (to)   q = q.where("createdAt", "<=", toTs(to));
    const snap = await q.get();
    let incomes = 0, expenses = 0;
    snap.forEach((doc) => {
      const f = doc.data();
      const amount = Number(f.amount || 0);
      if (f.type === "income")  incomes  += amount;
      if (f.type === "expense") expenses += amount;
    });
    return { incomes, expenses, balance: incomes - expenses };
  } catch (e) {
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
    // Fetch sales (cached) + financials en paralelo
    const [allDocs, finSnap] = await Promise.all([
      fetchAllSalesDocs({ from, to }),
      (() => {
        let q = col("financials").orderBy("createdAt", "desc");
        if (from) q = q.where("createdAt", ">=", toTs(from));
        if (to)   q = q.where("createdAt", "<=", toTs(to));
        return q.get().catch(() => ({ forEach: () => {} }));
      })(),
    ]);

    // Precios de compra para calcular costo de mercancía
    const productIds = new Set();
    allDocs.forEach((sale) => {
      (sale.items || []).forEach((it) => {
        const pid = extractProductId(it);
        if (pid) productIds.add(pid);
      });
    });
    const productPrices = {};
    if (productIds.size > 0) {
      const arr = Array.from(productIds);
      const chunks = [];
      for (let i = 0; i < arr.length; i += 10) chunks.push(arr.slice(i, i + 10));
      for (const ch of chunks) {
        const pdocs = await col("products")
          .where(firestore.FieldPath.documentId(), "in", ch)
          .get();
        pdocs.forEach((d) => { productPrices[d.id] = d.data().purchasePrice || 0; });
      }
    }

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

      // Serie diaria
      const ts = sale.createdAt?.toDate ? sale.createdAt.toDate() : null;
      if (ts) {
        const day = ts.toISOString().slice(0, 10);
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
          saleCost += (productPrices[pid] || 0) * qty;
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
      financialDocs.push(f);
      const amount = Number(f.amount || 0);
      if (f.type === "income")  extIncomes  += amount;
      if (f.type === "expense") extExpenses += amount;
    });

    // Timeseries ordenada por fecha
    const timeseries = Object.entries(dailySales)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date, income: v.income, count: v.count }));

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

/** Invalida las cachés financieras (llámalo junto con clearReportsCache) */
export function clearFinancialCache() {
  _financialDetailCache.clear();
}

/** Obtiene todos los usuarios del sistema con su actividad reciente */
export function subscribeUsersActivity(callback) {
  return col("users").onSnapshot(
    async (snap) => {
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

export async function getActivityFeedPage({ cursors = {}, from, to, limit = 10 }) {
  try {
    const results = [];

    // Colecciones a consultar: se añaden presales como fuente de actividad
    const collections = [
      { col: "sales",              kind: "sale"      },
      { col: "presales",           kind: "presale"   },
      { col: "inventoryMovements", kind: "inventory" },
      { col: "financials",         kind: "financial" },
    ];

    let newCursors = { ...cursors };

    for (const c of collections) {
      let q = col(c.col).orderBy("createdAt", "desc").limit(limit);
      if (from) q = q.where("createdAt", ">=", toTs(from));
      if (to)   q = q.where("createdAt", "<=", toTs(to));
      if (cursors[c.col]) q = q.startAfter(cursors[c.col]);

      const snap = await q.get();
      if (!snap.empty) {
        newCursors[c.col] = snap.docs[snap.docs.length - 1];
        snap.docs.forEach((doc) => {
          const data = doc.data();

          // Para presales, solo incluir las completadas en el feed de actividad
          if (c.col === "presales" && !COMPLETED_PRESALE_STATUSES.has(data.status)) {
            return;
          }

          results.push({
            id: doc.id,
            ...data,
            __kind: c.kind,
            _uid: `${c.kind}_${doc.id}`,
          });
        });
      }
    }

    results.sort(
      (a, b) =>
        (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)
    );

    return { items: results.slice(0, limit), cursors: newCursors };
  } catch (e) {
    console.error("ERROR getActivityFeedPage:", e);
    return { items: [], cursors };
  }
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

    // Clientes sin ID en catálogo (ventas con nombre libre)
    const anonymousSales = Object.values(salesMap).filter(
      (s) => s.customerId && !catalog[s.customerId]
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

