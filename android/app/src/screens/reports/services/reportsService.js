import firestore, { Timestamp } from "@react-native-firebase/firestore";

const col = (name) => firestore().collection(name);

const toTs = (d) => (d instanceof Date ? Timestamp.fromDate(d) : d);

const extractProductId = (it) => {
  return it.id || it.productId || it.product?.productId || it.product?.id || null;
};

export async function getSalesSummaryOptimized({ from, to, topN = 10 }) {
  try {
    let q = col("sales_operations").orderBy("createdAt");
    if (from) q = q.where("createdAt", ">=", toTs(from));
    if (to) q = q.where("createdAt", "<=", toTs(to));

    const snap = await q.get();
    if (snap.empty) {
      return { totalIncome: 0, totalCost: 0, profit: 0, avgPerSale: 0, totalSalesCount: 0, topProducts: [], timeseries: [], salesByEmployee: [], bestClients: [] };
    }

    let totalIncome = 0, totalCost = 0;
    const productCount = {}, employeeTotals = {}, clientTotals = {};

    snap.forEach((doc) => {
      const sale = doc.data();
      const saleTotal = Number(sale.total ?? sale.subtotal ?? 0);
      totalIncome += saleTotal;
      (sale.items || []).forEach((it) => {
        const qty = Number(it.quantity ?? it.qty ?? 0);
        const productId = extractProductId(it);
        if (productId && qty > 0) productCount[productId] = (productCount[productId] || 0) + qty;
      });
      if (sale.soldById) employeeTotals[sale.soldById] = (employeeTotals[sale.soldById] || 0) + saleTotal;
      if (sale.customerId) clientTotals[sale.customerId] = (clientTotals[sale.customerId] || 0) + saleTotal;
    });

    return {
      totalIncome,
      totalCost,
      profit: totalIncome - totalCost,
      avgPerSale: totalIncome / Math.max(snap.size, 1),
      totalSalesCount: snap.size,
      topProducts: Object.entries(productCount).map(([productId, qty]) => ({ productId, qty })).sort((a, b) => b.qty - a.qty).slice(0, topN),
      salesByEmployee: Object.entries(employeeTotals).map(([id, total]) => ({ id, total })).sort((a, b) => b.total - a.total),
      bestClients: Object.entries(clientTotals).map(([customerId, total]) => ({ customerId, total })).sort((a, b) => b.total - a.total).slice(0, topN),
    };
  } catch (e) {
    console.log("ERROR getSalesSummaryOptimized:", e);
    return null;
  }
}

export async function getFinancialSummary({ from, to }) {
  try {
    let q = col("financials").orderBy("createdAt");
    if (from) q = q.where("createdAt", ">=", toTs(from));
    if (to) q = q.where("createdAt", "<=", toTs(to));
    const snap = await q.get();
    let incomes = 0, expenses = 0;
    snap.forEach((doc) => {
      const f = doc.data();
      const amount = Number(f.amount || 0);
      if (f.type === "income") incomes += amount;
      if (f.type === "expense") expenses += amount;
    });
    return { incomes, expenses, balance: incomes - expenses };
  } catch (e) {
    console.log("ERROR getFinancialSummary:", e);
    return null;
  }
}

export async function getActivityFeedPage({ cursors = {}, from, to, limit = 10 }) {
  try {
    const results = [];
    const collections = [
      { col: "sales_operations", kind: "sale" },
      { col: "inventoryMovements", kind: "inventory" },
      { col: "financials", kind: "financial" },
      { col: "product_movements", kind: "product_activity" },
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
          results.push({ id: doc.id, ...doc.data(), __kind: c.kind, _uid: `${c.kind}_${doc.id}` });
        });
      }
    }

    results.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

    return { items: results.slice(0, limit), cursors: newCursors };
  } catch (e) {
    console.log("ERROR getActivityFeedPage:", e);
    return { items: [], cursors };
  }
}
