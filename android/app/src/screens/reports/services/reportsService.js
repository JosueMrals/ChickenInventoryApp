import firestore from "@react-native-firebase/firestore";

const col = (name) => firestore().collection(name);

/******************************************
 * 🔥 UTILIDADES V4.1
 ******************************************/

// Convierte Date JS → Firestore Timestamp
const toTs = (d) =>
  d instanceof Date ? firestore.Timestamp.fromDate(d) : d;

// EXTRAER PRODUCT ID SEGÚN TU BD REAL
// Tus ventas guardan:
// it.id = productId real
// it.quantity = cantidad
const extractProductId = (it) => {
  return (
    it.id ||               // ✔ ESTO ES LO QUE TU BD REAL USA
    it.productId ||
    it.product?.productId ||
    it.product?.id ||
    null
  );
};

/******************************************
 * 🔥 1. SALES SUMMARY — V4.1 COMPATIBLE
 ******************************************/
export async function getSalesSummaryOptimized({ from, to, topN = 10 }) {
  try {
    let q = col("sales").orderBy("createdAt");

    if (from) q = q.where("createdAt", ">=", toTs(from));
    if (to) q = q.where("createdAt", "<=", toTs(to));

    const snap = await q.get();
    if (snap.empty) {
      return {
        totalIncome: 0,
        totalCost: 0,
        profit: 0,
        avgPerSale: 0,
        totalSalesCount: 0,
        topProducts: [],
        timeseries: [],
        salesByEmployee: [],
        bestClients: [],
      };
    }

    let totalIncome = 0;
    let totalCost = 0; // Tus ventas no tienen cost, quedará 0
    let totalSalesCount = snap.size;
    let timeseries = [];

    const productCount = {};
    const employeeTotals = {};
    const clientTotals = {};

    snap.forEach((doc) => {
      const sale = doc.data();

      // === Totales ===
      const saleTotal = Number(sale.total ?? sale.subtotal ?? 0);
      totalIncome += saleTotal;

      // === Series ===
      timeseries.push(saleTotal);

      // === Items ===
      (sale.items || []).forEach((it) => {
        const qty = Number(it.quantity ?? it.qty ?? 0);
        const productId = extractProductId(it);

        if (!productId || qty <= 0) return;

        productCount[productId] = (productCount[productId] || 0) + qty;
      });

      // === Ventas por empleado ===
      if (sale.soldById) {
        employeeTotals[sale.soldById] =
          (employeeTotals[sale.soldById] || 0) + saleTotal;
      }

      // === Mejores clientes ===
      if (sale.customerId) {
        clientTotals[sale.customerId] =
          (clientTotals[sale.customerId] || 0) + saleTotal;
      }
    });

    // === TOP PRODUCTOS ===
    const topProducts = Object.entries(productCount)
      .map(([productId, qty]) => ({ productId, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, topN);

    // === VENTAS POR EMPLEADO ===
    const salesByEmployee = Object.entries(employeeTotals)
      .map(([id, total]) => ({ id, total }))
      .sort((a, b) => b.total - a.total);

    // === CLIENTES TOP ===
    const bestClients = Object.entries(clientTotals)
      .map(([customerId, total]) => ({ customerId, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, topN);

    return {
      totalIncome,
      totalCost,
      profit: totalIncome - totalCost,
      avgPerSale: totalIncome / Math.max(totalSalesCount, 1),
      totalSalesCount,
      topProducts,
      timeseries,
      salesByEmployee,
      bestClients,
    };
  } catch (e) {
    console.log("ERROR getSalesSummaryOptimized V4.1:", e);
    return null;
  }
}

/******************************************
 * 🔥 2. FINANCIAL SUMMARY V4.1
 ******************************************/
export async function getFinancialSummary({ from, to }) {
  try {
    let q = col("financials").orderBy("createdAt");

    if (from) q = q.where("createdAt", ">=", toTs(from));
    if (to) q = q.where("createdAt", "<=", toTs(to));

    const snap = await q.get();

    let incomes = 0;
    let expenses = 0;
    const series = [];

    snap.forEach((doc) => {
      const f = doc.data();
      const amount = Number(f.amount || 0);

      if (f.type === "income") incomes += amount;
      if (f.type === "expense") expenses += amount;

      series.push(f.type === "income" ? amount : -amount);
    });

    return {
      incomes,
      expenses,
      balance: incomes - expenses,
      series,
    };
  } catch (e) {
    console.log("ERROR getFinancialSummary V4.1:", e);
    return null;
  }
}

/******************************************
 * 🔥 3. TOP PRODUCTS V4.1
 ******************************************/
export async function getTopProducts({ from, to, topN = 20 }) {
  try {
    let q = col("sales").orderBy("createdAt");

    if (from) q = q.where("createdAt", ">=", toTs(from));
    if (to) q = q.where("createdAt", "<=", toTs(to));

    const snap = await q.get();
    const counter = {};

    snap.forEach((s) => {
      (s.data().items || []).forEach((it) => {
        const qty = Number(it.quantity ?? it.qty ?? 0);
        const productId = extractProductId(it);

        if (!productId) return;

        counter[productId] = (counter[productId] || 0) + qty;
      });
    });

    return Object.entries(counter)
      .map(([productId, qty]) => ({ productId, qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, topN);
  } catch (e) {
    console.log("ERROR getTopProducts V4.1:", e);
    return [];
  }
}

/******************************************
 * 🔥 4. INVENTORY MOVEMENTS V4.1
 ******************************************/
export async function getInventoryMovements({ from, to, limit = 50 }) {
  try {
    let q = col("inventoryMovements")
      .orderBy("createdAt", "desc")
      .limit(limit);

    if (from) q = q.where("createdAt", ">=", toTs(from));
    if (to) q = q.where("createdAt", "<=", toTs(to));

    const snap = await q.get();

    return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.log("ERROR getInventoryMovements V4.1:", e);
    return [];
  }
}

/******************************************
 * 🔥 5. SALES BY EMPLOYEE V4.1
 ******************************************/
export async function getSalesByEmployee({ from, to }) {
  try {
    let q = col("sales").orderBy("createdAt");

    if (from) q = q.where("createdAt", ">=", toTs(from));
    if (to) q = q.where("createdAt", "<=", toTs(to));

    const snap = await q.get();
    const totals = {};

    snap.forEach((doc) => {
      const s = doc.data();
      const saleTotal = Number(s.total ?? s.subtotal ?? 0);

      if (s.soldById) {
        totals[s.soldById] = (totals[s.soldById] || 0) + saleTotal;
      }
    });

    return Object.entries(totals)
      .map(([id, total]) => ({ id, total }))
      .sort((a, b) => b.total - a.total);
  } catch (e) {
    console.log("ERROR getSalesByEmployee V4.1:", e);
    return [];
  }
}

/******************************************
 * 🔥 6. BEST CLIENTS V4.1
 ******************************************/
export async function getBestClients({ from, to, topN = 20 }) {
  try {
    let q = col("sales").orderBy("createdAt");

    if (from) q = q.where("createdAt", ">=", toTs(from));
    if (to) q = q.where("createdAt", "<=", toTs(to));

    const snap = await q.get();
    const totals = {};

    snap.forEach((doc) => {
      const s = doc.data();
      const saleTotal = Number(s.total ?? s.subtotal ?? 0);

      if (s.customerId) {
        totals[s.customerId] = (totals[s.customerId] || 0) + saleTotal;
      }
    });

    return Object.entries(totals)
      .map(([customerId, total]) => ({ customerId, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, topN);
  } catch (e) {
    console.log("ERROR getBestClients V4.1:", e);
    return [];
  }
}

/******************************************
 * 🔥 7. ACTIVITY FEED PAGINADO V4.1
 ******************************************/
export async function getActivityFeedPage({
  cursors = {},
  from,
  to,
  limit = 15,
}) {
  try {
    const results = [];
    const collections = [
      { col: "sales", kind: "sale" },
      { col: "inventoryMovements", kind: "inventory" },
      { col: "financials", kind: "financial" },
    ];

    let newCursors = { ...cursors };

    for (const c of collections) {
      let q = col(c.col).orderBy("createdAt", "desc").limit(limit);

      if (from) q = q.where("createdAt", ">=", toTs(from));
      if (to) q = q.where("createdAt", "<=", toTs(to));
      if (cursors[c.col]) q = q.startAfter(cursors[c.col]);

      const snap = await q.get();
      if (!snap.empty) {
        const last = snap.docs[snap.docs.length - 1];
        newCursors[c.col] = last;

        snap.docs.forEach((doc) => {
          results.push({
            id: doc.id,
            ...doc.data(),
            __kind: c.kind,
            _uid: `${c.kind}_${doc.id}`,
          });
        });
      }
    }

    results.sort((a, b) => {
      const ta = a.createdAt?.toMillis?.() || 0;
      const tb = b.createdAt?.toMillis?.() || 0;
      return tb - ta;
    });

    return { items: results, cursors: newCursors };
  } catch (e) {
    console.log("ERROR getActivityFeedPage V4.1:", e);
    return { items: [], cursors };
  }
}
