/**
 * Nómina: cálculo del estado de cuenta y cierre de periodo.
 *
 * El cierre mueve dinero (paga un salario y marca faltantes como cobrados), así
 * que es exactamente el tipo de operación que no puede ejecutarse dos veces:
 * contar un adelanto ya saldado lo descontaría del sueldo por segunda vez. Igual
 * que en el resto de la app, lo que decide es lo RELEÍDO dentro de la
 * transacción, no lo que traía la pantalla.
 *
 * El mock de Firestore está namespaced por colección (`col::id`), no solo por
 * id: desde S1.10 FINAL, `settleStaffPeriod` lee TRES colecciones distintas
 * (`users`, `staffSalaries`, `payrollSettlements`) y un mock plano por id
 * dejaría que un `users/u1` y un `staffSalaries/u1` se pisaran entre sí.
 */

const mockState = { docs: {}, writes: [], deletes: [] };
const key = (col, id) => `${col}::${id}`;

jest.mock('@react-native-firebase/firestore', () => {
  const firestore = () => ({
    collection: (name) => ({
      doc: (id) => ({
        id: id || `${name}-auto-${Object.keys(mockState.docs).length + 1}`,
        __col: name,
      }),
      where: function () { return this; },
      orderBy: function () { return this; },
      limit: function () { return this; },
      onSnapshot: () => () => {},
    }),
    runTransaction: async (fn) => fn({
      // `exists` es un MÉTODO en @react-native-firebase v23 (FirestoreDocumentSnapshot),
      // no una propiedad. El mock lo replica tal cual: si fuera un booleano, el
      // test pasaría con código que en producción nunca entra a la guarda.
      get: async (ref) => ({
        id: ref.id,
        ref,
        exists: () => !!mockState.docs[key(ref.__col, ref.id)],
        data: () => mockState.docs[key(ref.__col, ref.id)],
      }),
      set: (ref, payload) => {
        mockState.docs[key(ref.__col, ref.id)] = { ...payload };
        mockState.writes.push({ col: ref.__col, id: ref.id, op: 'set', payload });
      },
      update: (ref, payload) => {
        // `increment()` llega como el sentinel `{__inc}` (ver FieldValue abajo):
        // se resuelve numéricamente contra el valor previo, igual que Firestore real.
        const k = key(ref.__col, ref.id);
        const resolved = Object.fromEntries(
          Object.entries(payload).map(([field, value]) =>
            value && typeof value === 'object' && '__inc' in value
              ? [field, (mockState.docs[k]?.[field] || 0) + value.__inc]
              : [field, value],
          ),
        );
        mockState.docs[k] = { ...mockState.docs[k], ...resolved };
        mockState.writes.push({ col: ref.__col, id: ref.id, op: 'update', payload });
      },
      delete: (ref) => {
        const k = key(ref.__col, ref.id);
        delete mockState.docs[k];
        mockState.deletes.push(k);
      },
    }),
  });
  firestore.FieldValue = { serverTimestamp: () => 'ts', increment: (n) => ({ __inc: n }) };
  return firestore;
});

jest.mock('@react-native-firebase/auth', () => () => ({
  currentUser: { uid: 'admin-1', email: 'admin@test.com' },
}));

const {
  buildStaffAccount,
  settleStaffPeriod,
  createStaffPurchase,
} = require('../android/app/src/screens/payroll/services/payrollService');

const setDoc = (col, id, data) => { mockState.docs[key(col, id)] = data; };
const getDoc = (col, id) => mockState.docs[key(col, id)];
const deleteDoc = (col, id) => { delete mockState.docs[key(col, id)]; };

beforeEach(() => {
  mockState.docs = {};
  mockState.writes = [];
  mockState.deletes = [];
});

const staff = (overrides = {}) => ({
  uid: 'u1', nombre: 'Ana', apellido: 'Ruiz', role: 'entregador', salary: 5000, ...overrides,
});

describe('buildStaffAccount', () => {
  test('suma las tres deducciones y calcula el neto', () => {
    const account = buildStaffAccount(
      staff(),
      [{ id: 'a1', uid: 'u1', amount: 500 }, { id: 'a2', uid: 'u1', amount: 250 }],
      [{ id: 'p1', uid: 'u1', total: 300 }],
      [{ id: 's1', entregadorId: 'u1', totalMissingValue: 150 }],
    );

    expect(account.advancesTotal).toBe(750);
    expect(account.purchasesTotal).toBe(300);
    expect(account.shortagesTotal).toBe(150);
    expect(account.deductionsTotal).toBe(1200);
    expect(account.netPay).toBe(3800);
  });

  test('solo cuenta lo del propio trabajador', () => {
    const account = buildStaffAccount(
      staff(),
      [{ id: 'a1', uid: 'u1', amount: 500 }, { id: 'a2', uid: 'otro', amount: 999 }],
      [{ id: 'p1', uid: 'otro', total: 999 }],
      // Los faltantes se guardan contra `entregadorId`, no `uid`.
      [{ id: 's1', entregadorId: 'u1', totalMissingValue: 100 }, { id: 's2', entregadorId: 'otro', totalMissingValue: 999 }],
    );

    expect(account.advancesTotal).toBe(500);
    expect(account.purchasesTotal).toBe(0);
    expect(account.shortagesTotal).toBe(100);
    expect(account.netPay).toBe(4400);
  });

  test('un neto negativo se conserva: el trabajador queda debiendo', () => {
    const account = buildStaffAccount(
      staff({ salary: 1000 }),
      [{ id: 'a1', uid: 'u1', amount: 1500 }],
      [], [],
    );

    expect(account.netPay).toBe(-500);
  });

  test('sin salario configurado el neto refleja solo la deuda', () => {
    const account = buildStaffAccount(staff({ salary: null }), [{ id: 'a1', uid: 'u1', amount: 200 }], [], []);
    expect(account.netPay).toBe(-200);
  });
});

describe('settleStaffPeriod', () => {
  const buildAccount = () =>
    buildStaffAccount(
      staff(),
      [{ id: 'a1', uid: 'u1', amount: 500 }],
      [{ id: 'p1', uid: 'u1', total: 300 }],
      [{ id: 's1', entregadorId: 'u1', totalMissingValue: 200 }],
    );

  const seedServer = () => {
    setDoc('users', 'u1', { nombre: 'Ana', apellido: 'Ruiz', role: 'entregador' });
    setDoc('staffSalaries', 'u1', { salary: 5000 });
    setDoc('payrollAdvances', 'a1', { uid: 'u1', amount: 500, settlementId: null });
    setDoc('staffPurchases', 'p1', { uid: 'u1', total: 300, settlementId: null });
    setDoc('deliveryShortages', 's1', { entregadorId: 'u1', totalMissingValue: 200, status: 'pending' });
  };

  test('registra el pago y deja el periodo en cero', async () => {
    seedServer();

    const settlement = await settleStaffPeriod(buildAccount());

    expect(settlement.netPay).toBe(4000); // 5000 - (500 + 300 + 200)
    expect(getDoc('payrollAdvances', 'a1').settlementId).toBe(settlement.id);
    expect(getDoc('staffPurchases', 'p1').settlementId).toBe(settlement.id);
    expect(getDoc('deliveryShortages', 's1').status).toBe('payroll_deducted');
  });

  test('no vuelve a descontar un adelanto ya saldado en otro cierre', async () => {
    seedServer();
    // La pantalla todavía lo muestra pendiente, pero en el servidor ya se pagó.
    setDoc('payrollAdvances', 'a1', { uid: 'u1', amount: 500, settlementId: 'cierre-anterior' });

    const settlement = await settleStaffPeriod(buildAccount());

    expect(settlement.advancesTotal).toBe(0);
    expect(settlement.netPay).toBe(4500); // 5000 - (300 + 200)
    expect(settlement.advanceIds).toEqual([]);
    // El adelanto viejo conserva su cierre original.
    expect(getDoc('payrollAdvances', 'a1').settlementId).toBe('cierre-anterior');
  });

  test('no vuelve a cobrar un faltante que ya se repuso en producto', async () => {
    seedServer();
    setDoc('deliveryShortages', 's1', { entregadorId: 'u1', totalMissingValue: 200, status: 'fulfilled' });

    const settlement = await settleStaffPeriod(buildAccount());

    expect(settlement.shortagesTotal).toBe(0);
    expect(settlement.netPay).toBe(4200); // 5000 - (500 + 300)
    expect(getDoc('deliveryShortages', 's1').status).toBe('fulfilled'); // sin tocar
  });

  test('usa el salario del servidor (staffSalaries), no el que traía la pantalla', async () => {
    seedServer();
    setDoc('staffSalaries', 'u1', { salary: 6000 }); // otro admin lo subió mientras tanto

    const settlement = await settleStaffPeriod(buildAccount());

    expect(settlement.salary).toBe(6000);
    expect(settlement.netPay).toBe(5000); // 6000 - 1000
  });

  // S1.10-F6: el id del settlement es determinístico (función de QUÉ se
  // liquida, no un contador) — un segundo intento con el MISMO `account` en
  // memoria choca contra el settlement que el primero ya creó, en vez de
  // crear un segundo pago con deducciones en cero.
  test('un segundo intento con el mismo account (retry) es rechazado, no crea un pago duplicado', async () => {
    seedServer();
    const account = buildAccount();

    const first = await settleStaffPeriod(account);
    await expect(settleStaffPeriod(account)).rejects.toThrow(/ya se registró un pago/i);

    // Solo existe el settlement del primer intento.
    expect(mockState.writes.filter((w) => w.col === 'payrollSettlements' && w.op === 'set')).toHaveLength(1);
    expect(getDoc('payrollAdvances', 'a1').settlementId).toBe(first.id);
  });

  // La guarda de "documento inexistente" solo funciona si se llama exists() como
  // método. Con `snap.exists` (propiedad) la condición nunca se cumple porque la
  // función es truthy, y el cierre seguiría adelante pagando un salario de 0.
  test('rechaza cerrar si el trabajador ya no existe en el servidor', async () => {
    seedServer();
    deleteDoc('users', 'u1');

    await expect(settleStaffPeriod(buildAccount())).rejects.toThrow(/ya no existe/);
    expect(mockState.writes).toHaveLength(0);
  });

  test('rechaza cerrar si no hay salario configurado en el servidor (staffSalaries inexistente)', async () => {
    seedServer();
    deleteDoc('staffSalaries', 'u1');

    await expect(settleStaffPeriod(buildAccount())).rejects.toThrow(/salario/i);
    expect(mockState.writes).toHaveLength(0);
  });

  test('ignora un adelanto borrado entre la lectura de pantalla y el cierre', async () => {
    seedServer();
    deleteDoc('payrollAdvances', 'a1');

    const settlement = await settleStaffPeriod(buildAccount());

    expect(settlement.advanceIds).toEqual([]);
    expect(settlement.advancesTotal).toBe(0);
    expect(settlement.netPay).toBe(4500); // 5000 - (300 + 200)
  });

  test('rechaza cerrar sin salario configurado (guarda de cliente, antes de la transacción)', async () => {
    seedServer();
    const account = buildStaffAccount(staff({ salary: null }), [], [], []);

    await expect(settleStaffPeriod(account)).rejects.toThrow(/salario/i);
    expect(mockState.writes).toHaveLength(0);
  });
});

/**
 * S1.10-F4: la transacción releía advances/purchases/shortages por el ID que
 * trae `account`, pero solo verificaba existencia/`settlementId`/`status` — no
 * que el documento perteneciera al trabajador que se está liquidando. Un
 * `account` armado a mano (cliente modificado, sin pasar por el filtro
 * `own()` de `buildStaffAccount`) simula exactamente ese caso.
 */
describe('settleStaffPeriod — S1.10-F4 (cross-employee)', () => {
  const seedWorker = (uid = 'u1', salary = 5000) => {
    setDoc('users', uid, { nombre: 'Ana', apellido: 'Ruiz', role: 'entregador' });
    setDoc('staffSalaries', uid, { salary });
  };

  test('un adelanto de OTRO trabajador incluido en el account no se descuenta ni se salda', async () => {
    seedWorker();
    setDoc('payrollAdvances', 'a-other', { uid: 'u-other', amount: 999, settlementId: null });

    const forgedAccount = {
      staff: staff(),
      advances: [{ id: 'a-other', uid: 'u-other', amount: 999 }],
      purchases: [],
      shortages: [],
    };

    const settlement = await settleStaffPeriod(forgedAccount);

    expect(settlement.advancesTotal).toBe(0);
    expect(settlement.advanceIds).toEqual([]);
    expect(settlement.netPay).toBe(5000);
    // El adelanto ajeno queda intacto: no se marcó como saldado ni se tocó.
    expect(getDoc('payrollAdvances', 'a-other').settlementId).toBeNull();
  });

  test('una compra de OTRO trabajador incluida en el account no se descuenta ni se salda', async () => {
    seedWorker();
    setDoc('staffPurchases', 'p-other', { uid: 'u-other', total: 777, settlementId: null });

    const forgedAccount = {
      staff: staff(),
      advances: [],
      purchases: [{ id: 'p-other', uid: 'u-other', total: 777 }],
      shortages: [],
    };

    const settlement = await settleStaffPeriod(forgedAccount);

    expect(settlement.purchasesTotal).toBe(0);
    expect(settlement.purchaseIds).toEqual([]);
    expect(settlement.netPay).toBe(5000);
    expect(getDoc('staffPurchases', 'p-other').settlementId).toBeNull();
  });

  test('un faltante de OTRO entregador incluido en el account no se descuenta ni se salda', async () => {
    seedWorker();
    setDoc('deliveryShortages', 's-other', { entregadorId: 'u-other', totalMissingValue: 250, status: 'pending' });

    const forgedAccount = {
      staff: staff(),
      advances: [],
      purchases: [],
      shortages: [{ id: 's-other', entregadorId: 'u-other', totalMissingValue: 250 }],
    };

    const settlement = await settleStaffPeriod(forgedAccount);

    expect(settlement.shortagesTotal).toBe(0);
    expect(settlement.shortageIds).toEqual([]);
    expect(settlement.netPay).toBe(5000);
    expect(getDoc('deliveryShortages', 's-other').status).toBe('pending'); // sin tocar
  });

  test('mezcla: deducciones propias sí se aplican, la ajena queda excluida', async () => {
    seedWorker();
    setDoc('payrollAdvances', 'a1', { uid: 'u1', amount: 500, settlementId: null });
    setDoc('payrollAdvances', 'a-other', { uid: 'u-other', amount: 999, settlementId: null });

    const forgedAccount = {
      staff: staff(),
      advances: [
        { id: 'a1', uid: 'u1', amount: 500 },
        { id: 'a-other', uid: 'u-other', amount: 999 },
      ],
      purchases: [],
      shortages: [],
    };

    const settlement = await settleStaffPeriod(forgedAccount);

    expect(settlement.advancesTotal).toBe(500);
    expect(settlement.advanceIds).toEqual(['a1']);
    expect(settlement.netPay).toBe(4500);
    expect(getDoc('payrollAdvances', 'a1').settlementId).toBe(settlement.id);
    expect(getDoc('payrollAdvances', 'a-other').settlementId).toBeNull();
  });
});

/**
 * S1.10-F6: identidad determinística del settlement — dos intentos que parten
 * del MISMO `account` (doble tap, dos dispositivos mirando la misma cuenta,
 * un reintento tras perder la respuesta de red) calculan el MISMO id; solo
 * uno logra crearlo, el otro es rechazado explícitamente.
 */
describe('settleStaffPeriod — S1.10-F6 (idempotencia / concurrencia)', () => {
  const seedWorker = (uid, salary, advances = [], purchases = [], shortages = []) => {
    setDoc('users', uid, { nombre: 'Beto', apellido: 'Solano', role: 'vendedor' });
    setDoc('staffSalaries', uid, { salary });
    advances.forEach((a) => setDoc('payrollAdvances', a.id, { uid, amount: a.amount, settlementId: null }));
    purchases.forEach((p) => setDoc('staffPurchases', p.id, { uid, total: p.total, settlementId: null }));
    shortages.forEach((s) => setDoc('deliveryShortages', s.id, { entregadorId: uid, totalMissingValue: s.amount, status: 'pending' }));
  };

  test('primer settlement (worker + deducciones) permitido', async () => {
    seedWorker('w1', 3000, [{ id: 'adv1', amount: 100 }]);
    const account = buildStaffAccount(
      { uid: 'w1', role: 'vendedor', salary: 3000 },
      [{ id: 'adv1', uid: 'w1', amount: 100 }], [], [],
    );

    const settlement = await settleStaffPeriod(account);
    expect(settlement.netPay).toBe(2900);
  });

  // La concurrencia REAL (dos transacciones compitiendo por el mismo doc, con
  // reintento automático de Firestore) no puede simularse fielmente con este
  // mock lineal — no tiene aislamiento optimista entre llamadas. Se prueba
  // contra el Firestore Emulator real en
  // `__tests__/emulator/payrollRules.test.js`. Lo que SÍ es determinístico
  // aquí es que el MISMO `account`, invocado dos veces en secuencia (el caso
  // que realmente importa: doble-tap resuelto por orden de llegada, o un
  // reintento), calcula el mismo id y la segunda choca — ver el test de
  // arriba y el de retry de abajo.

  test('retry tras perder la respuesta de red (mismo account, llamada secuencial) no duplica el pago', async () => {
    seedWorker('w3', 4000, [{ id: 'adv3', amount: 200 }]);
    const account = buildStaffAccount(
      { uid: 'w3', role: 'vendedor', salary: 4000 },
      [{ id: 'adv3', uid: 'w3', amount: 200 }], [], [],
    );

    await settleStaffPeriod(account); // "éxito", pero la app no se enteró
    await expect(settleStaffPeriod(account)).rejects.toThrow(/ya se registró un pago/i); // reintento

    const settlementWrites = mockState.writes.filter((w) => w.col === 'payrollSettlements' && w.op === 'set' && w.payload.uid === 'w3');
    expect(settlementWrites).toHaveLength(1);
  });

  test('mismo worker, deducciones DIFERENTES (periodo distinto): se permite un segundo settlement', async () => {
    seedWorker('w4', 2000, [{ id: 'adv4a', amount: 50 }]);
    const firstAccount = buildStaffAccount(
      { uid: 'w4', role: 'vendedor', salary: 2000 },
      [{ id: 'adv4a', uid: 'w4', amount: 50 }], [], [],
    );
    await settleStaffPeriod(firstAccount);

    // Un nuevo adelanto real llega después del primer cierre — periodo distinto.
    setDoc('payrollAdvances', 'adv4b', { uid: 'w4', amount: 75, settlementId: null });
    const secondAccount = buildStaffAccount(
      { uid: 'w4', role: 'vendedor', salary: 2000 },
      [{ id: 'adv4b', uid: 'w4', amount: 75 }], [], [],
    );

    const second = await settleStaffPeriod(secondAccount);
    expect(second.advancesTotal).toBe(75);
    expect(second.netPay).toBe(1925);

    const settlementWrites = mockState.writes.filter((w) => w.col === 'payrollSettlements' && w.op === 'set' && w.payload.uid === 'w4');
    expect(settlementWrites).toHaveLength(2);
  });

  test('worker DIFERENTE, mismas deducciones "vacías": settlements independientes, no chocan entre sí', async () => {
    seedWorker('w5', 1000, []);
    seedWorker('w6', 1500, []);
    const account5 = buildStaffAccount({ uid: 'w5', role: 'vendedor', salary: 1000 }, [], [], []);
    const account6 = buildStaffAccount({ uid: 'w6', role: 'vendedor', salary: 1500 }, [], [], []);

    const s5 = await settleStaffPeriod(account5);
    const s6 = await settleStaffPeriod(account6);

    expect(s5.netPay).toBe(1000);
    expect(s6.netPay).toBe(1500);
    expect(s5.id).not.toBe(s6.id);
  });

  test('un admin no puede re-liquidar el mismo periodo ya cerrado (mismas deducciones, llamada tardía)', async () => {
    seedWorker('w7', 2500, [{ id: 'adv7', amount: 300 }]);
    const account = buildStaffAccount(
      { uid: 'w7', role: 'vendedor', salary: 2500 },
      [{ id: 'adv7', uid: 'w7', amount: 300 }], [], [],
    );

    await settleStaffPeriod(account);
    // El admin, con la MISMA pantalla/cuenta que no se refrescó, intenta pagar otra vez.
    await expect(settleStaffPeriod(account)).rejects.toThrow(/ya se registró un pago/i);
  });
});

/**
 * S1.10-F5: `createStaffPurchase` releía el producto real solo para validar
 * stock; `unitPrice`/`total` de cada línea (y el total del documento) venían
 * tal cual los declaraba el cliente. Ahora se recalculan desde el producto
 * releído en la misma transacción.
 */
describe('createStaffPurchase — S1.10-F5 (integridad de precio)', () => {
  test('usa el precio real del producto (salePrice), ignora unitPrice/total declarados por el cliente', async () => {
    setDoc('products', 'prod-1', { name: 'Pollo entero', stock: 50, salePrice: 100, price: 80 });

    const purchaseId = await createStaffPurchase({
      uid: 'u1',
      userName: 'Ana Ruiz',
      items: [
        { productId: 'prod-1', productName: 'Pollo entero', quantity: 2, unitPrice: 1, total: 1 },
      ],
    });

    const saved = getDoc('staffPurchases', purchaseId);
    expect(saved.items[0].unitPrice).toBe(100);
    expect(saved.items[0].total).toBe(200);
    expect(saved.total).toBe(200);
  });

  test('usa price como respaldo cuando el producto no tiene salePrice', async () => {
    setDoc('products', 'prod-2', { name: 'Ala', stock: 30, price: 45 });

    const purchaseId = await createStaffPurchase({
      uid: 'u1',
      userName: 'Ana Ruiz',
      items: [{ productId: 'prod-2', productName: 'Ala', quantity: 3, unitPrice: 999, total: 999 }],
    });

    const saved = getDoc('staffPurchases', purchaseId);
    expect(saved.items[0].unitPrice).toBe(45);
    expect(saved.total).toBe(135);
  });

  test('el total del documento se recalcula desde las líneas verificadas, no se puede declarar aparte', async () => {
    setDoc('products', 'prod-3', { name: 'Muslo', stock: 20, salePrice: 60 });
    setDoc('products', 'prod-4', { name: 'Pechuga', stock: 20, salePrice: 90 });

    const purchaseId = await createStaffPurchase({
      uid: 'u1',
      userName: 'Ana Ruiz',
      items: [
        { productId: 'prod-3', productName: 'Muslo', quantity: 1, unitPrice: 1, total: 1 },
        { productId: 'prod-4', productName: 'Pechuga', quantity: 2, unitPrice: 1, total: 1 },
      ],
    });

    const saved = getDoc('staffPurchases', purchaseId);
    // 1×60 + 2×90 = 240, jamás la suma de los `total` fabricados (1+1=2).
    expect(saved.total).toBe(240);
  });

  test('descuenta el stock real del producto correctamente', async () => {
    setDoc('products', 'prod-5', { name: 'Pollo', stock: 10, salePrice: 70 });

    await createStaffPurchase({
      uid: 'u1',
      userName: 'Ana Ruiz',
      items: [{ productId: 'prod-5', productName: 'Pollo', quantity: 4, unitPrice: 1, total: 1 }],
    });

    expect(getDoc('products', 'prod-5').stock).toBe(6);
  });

  test('rechaza si el producto no existe', async () => {
    await expect(
      createStaffPurchase({
        uid: 'u1',
        userName: 'Ana Ruiz',
        items: [{ productId: 'prod-no-existe', productName: 'X', quantity: 1, unitPrice: 1, total: 1 }],
      }),
    ).rejects.toThrow(/no encontrado/);
  });
});
