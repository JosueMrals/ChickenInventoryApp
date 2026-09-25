/**
 * Concurrencia real de la validación de stock de Quick Sale, contra Firestore
 * Emulator real (no mock, no simulación manual del resultado).
 *
 * LIMITACIÓN DOCUMENTADA (ver audit-reports/fase22-*.md para el detalle):
 * `quickSaleService.registerQuickSaleFull()` importa `@react-native-firebase/
 * firestore` y `@react-native-firebase/auth`, que dependen del puente nativo de
 * React Native (`NativeModules`). Verificado empíricamente: intentar cargar ese
 * módulo sin mock bajo Jest falla con
 * "Native module RNFBAppModule not found" — no existe manera de invocar la
 * función real fuera de un runtime de Android/iOS real (algo fuera de alcance
 * de esta fase: no se agrega Detox/E2E).
 *
 * Lo que SÍ se puede validar de forma honesta contra el Emulator real es el
 * MISMO algoritmo (leer todos los productos dentro de la transacción → validar
 * stock → escribir venta+stock+movimientos+crédito) reimplementado aquí con el
 * SDK web `firebase` (que sí corre en Node), ejercitando el mecanismo real de
 * Firestore de conflicto+reintento de `runTransaction`. Esto prueba que el
 * PATRÓN es seguro bajo concurrencia real — no que se invocó literalmente
 * `registerQuickSaleFull()`. Esa distinción se documenta explícitamente en el
 * reporte de la fase, no se oculta.
 */
const {
  initializeTestEnvironment,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');
const {
  doc,
  collection,
  runTransaction,
  getDocs,
  setDoc,
  serverTimestamp,
} = require('firebase/firestore');
const fs = require('fs');
const path = require('path');

const RULES_PATH = path.resolve(__dirname, '../../firebase/firestore.rules');

let testEnv;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    // projectId propio y distinto al de securityRules.test.js: ambos archivos
    // corren contra el mismo Emulator local, y si Jest los ejecuta en paralelo
    // compartiendo projectId, el clearFirestore() de un archivo puede borrar
    // datos que el otro archivo acaba de sembrar a mitad de un test.
    projectId: 'chickeninventoryapp-emulator-test-quicksale',
    firestore: {
      rules: fs.readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  if (testEnv) await testEnv.cleanup();
});

afterEach(async () => {
  if (testEnv) await testEnv.clearFirestore();
});

// Mismo algoritmo que quickSaleService.registerQuickSaleFull (STEP 3 de FASE 21):
// lee TODOS los productos dentro de la transacción, valida stock agregado por
// producto, y solo entonces escribe venta + stock + movimientos + crédito.
async function simulateQuickSale(db, actorUid, { saleId, items, customerId = null, pendingAmount = 0 }) {
  return runTransaction(db, async (tx) => {
    const productIds = [...new Set(items.map((it) => it.productId))];
    const refs = productIds.map((id) => doc(db, 'products', id));
    const snaps = await Promise.all(refs.map((ref) => tx.get(ref)));

    const currentStock = {};
    snaps.forEach((snap, i) => {
      if (!snap.exists()) throw new Error(`Producto no encontrado: ${productIds[i]}`);
      currentStock[productIds[i]] = snap.data().stock;
    });

    const neededByProduct = {};
    items.forEach((it) => {
      neededByProduct[it.productId] = (neededByProduct[it.productId] || 0) + it.quantity;
    });

    Object.entries(neededByProduct).forEach(([id, needed]) => {
      if (currentStock[id] < needed) {
        throw new Error(`Stock insuficiente para ${id}. Disponible: ${currentStock[id]}, requerido: ${needed}`);
      }
    });

    // FASE S1.4.1: sales.create ahora exige el shape real de registerQuickSaleFull
    // (ver firestore.rules) — este payload deja de ser el mínimo {receiptNumber,
    // createdAt} que bastaba con la Rule vieja (isAdmin()||isVendedor() sin mirar
    // campos). `soldBy`/`soldById` deben coincidir con el actor autenticado.
    tx.set(doc(db, 'sales', saleId), {
      receiptNumber: saleId,
      subtotal: 0,
      total: 0,
      tip: 0,
      amountPaid: 0,
      change: 0,
      paymentMethod: 'cash',
      transferNumber: '',
      items: items.map((it) => ({
        id: it.productId, name: it.productId, quantity: it.quantity, unitPrice: 0,
        discount: 0, total: 0, purchasePrice: 0,
      })),
      createdAt: serverTimestamp(),
      soldBy: `${actorUid}@test.com`,
      soldById: actorUid,
      customerId,
      customerName: 'Venta Rápida',
      customerPhone: '',
    });

    productIds.forEach((id) => {
      tx.update(doc(db, 'products', id), {
        stock: currentStock[id] - neededByProduct[id],
        updatedAt: new Date(),
      });
    });

    items.forEach((it) => {
      tx.set(doc(collection(db, 'inventoryMovements')), {
        type: it.isBonus ? 'BONUS_OUT' : 'sale',
        productId: it.productId,
        quantity: it.quantity,
        relatedSaleId: saleId,
        createdByUid: actorUid,
        createdAt: new Date(),
      });
    });

    // FASE S1.6.1: credits.create (shape "desde venta rápida") ahora exige el
    // shape real de registerQuickSaleFull — createdBy/createdAt deben
    // coincidir con el actor autenticado/request.time, igual que en sales.create (S1.4.1).
    if (pendingAmount > 0 && customerId) {
      tx.set(doc(collection(db, 'credits')), {
        saleId, customerId, customerName: 'Venta Rápida', total: pendingAmount, paid: 0,
        pending: pendingAmount, status: 'pending', createdAt: serverTimestamp(),
        createdBy: `${actorUid}@test.com`, entregadorId: null,
      });
    }
  });
}

const seedProduct = async (id, stock) => {
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'products', id), { name: 'Pollo entero', stock });
  });
};

const readAllUnsecured = async (collectionName) => {
  let snap;
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    snap = await getDocs(collection(ctx.firestore(), collectionName));
  });
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
};

const readProduct = async (id) => {
  const products = await readAllUnsecured('products');
  return products.find((p) => p.id === id);
};

const vendedorDb = () => testEnv.authenticatedContext('vendedor-1', { role: 'vendedor', email: 'vendedor-1@test.com' }).firestore();

describe('Quick Sale — concurrencia real contra Firestore Emulator', () => {
  test('STEP 7 — stock=5, dos ventas de 4 concurrentes: una gana, la otra se rechaza, stock nunca negativo', async () => {
    await seedProduct('p1', 5);
    const db = vendedorDb();

    const results = await Promise.allSettled([
      simulateQuickSale(db, 'vendedor-1', { saleId: 'saleA', items: [{ productId: 'p1', quantity: 4 }] }),
      simulateQuickSale(db, 'vendedor-1', { saleId: 'saleB', items: [{ productId: 'p1', quantity: 4 }] }),
    ]);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason.message).toMatch(/stock insuficiente/i);

    const product = await readProduct('p1');
    expect(product.stock).toBe(1);
    expect(product.stock).toBeGreaterThanOrEqual(0);

    const sales = await readAllUnsecured('sales');
    expect(sales).toHaveLength(1);
    const movements = await readAllUnsecured('inventoryMovements');
    expect(movements).toHaveLength(1);
  });

  test('STEP 8 — stock=4, dos ventas de 4 concurrentes: una completa, stock termina en 0', async () => {
    await seedProduct('p1', 4);
    const db = vendedorDb();

    const results = await Promise.allSettled([
      simulateQuickSale(db, 'vendedor-1', { saleId: 'saleA', items: [{ productId: 'p1', quantity: 4 }] }),
      simulateQuickSale(db, 'vendedor-1', { saleId: 'saleB', items: [{ productId: 'p1', quantity: 4 }] }),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const product = await readProduct('p1');
    expect(product.stock).toBe(0);
  });

  test('STEP 9 — multi-producto: si uno de los dos no alcanza, ningún producto se modifica (atomicidad)', async () => {
    await seedProduct('pA', 10);
    await seedProduct('pB', 1);
    const db = vendedorDb();

    await expect(
      simulateQuickSale(db, 'vendedor-1', {
        saleId: 'saleMulti',
        items: [
          { productId: 'pA', quantity: 3 },
          { productId: 'pB', quantity: 5 }, // insuficiente
        ],
      })
    ).rejects.toThrow(/stock insuficiente/i);

    expect((await readProduct('pA')).stock).toBe(10);
    expect((await readProduct('pB')).stock).toBe(1);
    expect(await readAllUnsecured('sales')).toHaveLength(0);
    expect(await readAllUnsecured('inventoryMovements')).toHaveLength(0);
  });

  test('STEP 10 — bonus + normal: ambos movimientos se crean, stock refleja la suma', async () => {
    await seedProduct('p1', 20);
    const db = vendedorDb();

    await assertSucceeds(
      simulateQuickSale(db, 'vendedor-1', {
        saleId: 'saleBonus',
        items: [
          { productId: 'p1', quantity: 8 },
          { productId: 'p1', quantity: 2, isBonus: true },
        ],
      })
    );

    const movements = await readAllUnsecured('inventoryMovements');
    expect(movements.filter((m) => m.type === 'sale')).toHaveLength(1);
    expect(movements.filter((m) => m.type === 'BONUS_OUT')).toHaveLength(1);
    expect((await readProduct('p1')).stock).toBe(10); // 20 - 8 - 2
  });

  test('STEP 11 — crédito: si la transacción falla, tampoco queda crédito creado', async () => {
    await seedProduct('p1', 1);
    const db = vendedorDb();

    await expect(
      simulateQuickSale(db, 'vendedor-1', {
        saleId: 'saleCredit',
        items: [{ productId: 'p1', quantity: 5 }], // insuficiente
        customerId: 'c1',
        pendingAmount: 50,
      })
    ).rejects.toThrow(/stock insuficiente/i);

    expect(await readAllUnsecured('credits')).toHaveLength(0);
    expect(await readAllUnsecured('sales')).toHaveLength(0);
  });

  test('STEP 11b — crédito: si la transacción SÍ pasa, el crédito se crea junto con todo lo demás', async () => {
    await seedProduct('p1', 10);
    const db = vendedorDb();

    await assertSucceeds(
      simulateQuickSale(db, 'vendedor-1', {
        saleId: 'saleCreditOk',
        items: [{ productId: 'p1', quantity: 3 }],
        customerId: 'c1',
        pendingAmount: 20,
      })
    );

    expect(await readAllUnsecured('credits')).toHaveLength(1);
    expect(await readAllUnsecured('sales')).toHaveLength(1);
  });

  // STEP 12 — no es posible observar el reintento interno de runTransaction()
  // sin instrumentar el servicio de producción (prohibido esta fase: "NO
  // introducir logging permanente"). Queda validado INDIRECTAMENTE: STEP 7/8
  // prueban que, bajo conflicto real, exactamente una de las dos transacciones
  // concurrentes completa con datos consistentes — eso solo es posible si
  // Firestore reintentó la transacción perdedora con el stock ya actualizado
  // (si no reintentara, ambas leerían stock=5 y ambas pasarían la validación,
  // dejando stock negativo — que es precisamente lo que NUNCA se observó).
});
