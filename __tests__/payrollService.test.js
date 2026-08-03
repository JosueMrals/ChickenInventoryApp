/**
 * Nómina: cálculo del estado de cuenta y cierre de periodo.
 *
 * El cierre mueve dinero (paga un salario y marca faltantes como cobrados), así
 * que es exactamente el tipo de operación que no puede ejecutarse dos veces:
 * contar un adelanto ya saldado lo descontaría del sueldo por segunda vez. Igual
 * que en el resto de la app, lo que decide es lo RELEÍDO dentro de la
 * transacción, no lo que traía la pantalla.
 */

const mockState = { docs: {}, writes: [], deletes: [] };

jest.mock('@react-native-firebase/firestore', () => {
  const firestore = () => ({
    collection: (name) => ({
      doc: (id) => ({ id: id || `${name}-auto-${Object.keys(mockState.docs).length + 1}` }),
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
        exists: () => !!mockState.docs[ref.id],
        data: () => mockState.docs[ref.id],
      }),
      set: (ref, payload) => {
        mockState.docs[ref.id] = { ...payload };
        mockState.writes.push({ id: ref.id, op: 'set', payload });
      },
      update: (ref, payload) => {
        mockState.docs[ref.id] = { ...mockState.docs[ref.id], ...payload };
        mockState.writes.push({ id: ref.id, op: 'update', payload });
      },
      delete: (ref) => {
        delete mockState.docs[ref.id];
        mockState.deletes.push(ref.id);
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
} = require('../android/app/src/screens/payroll/services/payrollService');

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
    mockState.docs.u1 = { nombre: 'Ana', apellido: 'Ruiz', role: 'entregador', salary: 5000 };
    mockState.docs.a1 = { uid: 'u1', amount: 500, settlementId: null };
    mockState.docs.p1 = { uid: 'u1', total: 300, settlementId: null };
    mockState.docs.s1 = { entregadorId: 'u1', totalMissingValue: 200, status: 'pending' };
  };

  test('registra el pago y deja el periodo en cero', async () => {
    seedServer();

    const settlement = await settleStaffPeriod(buildAccount());

    expect(settlement.netPay).toBe(4000); // 5000 - (500 + 300 + 200)
    expect(mockState.docs.a1.settlementId).toBe(settlement.id);
    expect(mockState.docs.p1.settlementId).toBe(settlement.id);
    expect(mockState.docs.s1.status).toBe('payroll_deducted');
  });

  test('no vuelve a descontar un adelanto ya saldado en otro cierre', async () => {
    seedServer();
    // La pantalla todavía lo muestra pendiente, pero en el servidor ya se pagó.
    mockState.docs.a1 = { uid: 'u1', amount: 500, settlementId: 'cierre-anterior' };

    const settlement = await settleStaffPeriod(buildAccount());

    expect(settlement.advancesTotal).toBe(0);
    expect(settlement.netPay).toBe(4500); // 5000 - (300 + 200)
    expect(settlement.advanceIds).toEqual([]);
    // El adelanto viejo conserva su cierre original.
    expect(mockState.docs.a1.settlementId).toBe('cierre-anterior');
  });

  test('no vuelve a cobrar un faltante que ya se repuso en producto', async () => {
    seedServer();
    mockState.docs.s1 = { entregadorId: 'u1', totalMissingValue: 200, status: 'fulfilled' };

    const settlement = await settleStaffPeriod(buildAccount());

    expect(settlement.shortagesTotal).toBe(0);
    expect(settlement.netPay).toBe(4200); // 5000 - (500 + 300)
    expect(mockState.docs.s1.status).toBe('fulfilled'); // sin tocar
  });

  test('usa el salario del servidor, no el que traía la pantalla', async () => {
    seedServer();
    mockState.docs.u1.salary = 6000; // otro admin lo subió mientras tanto

    const settlement = await settleStaffPeriod(buildAccount());

    expect(settlement.salary).toBe(6000);
    expect(settlement.netPay).toBe(5000); // 6000 - 1000
  });

  test('un segundo cierre inmediato ya no encuentra deducciones que descontar', async () => {
    seedServer();
    const account = buildAccount();

    await settleStaffPeriod(account);
    // Mismo objeto de cuenta (la pantalla no se refrescó): todo ya está saldado.
    const second = await settleStaffPeriod(account);

    expect(second.deductionsTotal).toBe(0);
    expect(second.advanceIds).toEqual([]);
    expect(second.purchaseIds).toEqual([]);
    expect(second.shortageIds).toEqual([]);
  });

  // La guarda de "documento inexistente" solo funciona si se llama exists() como
  // método. Con `snap.exists` (propiedad) la condición nunca se cumple porque la
  // función es truthy, y el cierre seguiría adelante pagando un salario de 0.
  test('rechaza cerrar si el trabajador ya no existe en el servidor', async () => {
    seedServer();
    delete mockState.docs.u1;

    await expect(settleStaffPeriod(buildAccount())).rejects.toThrow(/ya no existe/);
    expect(mockState.writes).toHaveLength(0);
  });

  test('ignora un adelanto borrado entre la lectura de pantalla y el cierre', async () => {
    seedServer();
    delete mockState.docs.a1;

    const settlement = await settleStaffPeriod(buildAccount());

    expect(settlement.advanceIds).toEqual([]);
    expect(settlement.advancesTotal).toBe(0);
    expect(settlement.netPay).toBe(4500); // 5000 - (300 + 200)
  });

  test('rechaza cerrar sin salario configurado', async () => {
    seedServer();
    const account = buildStaffAccount(staff({ salary: null }), [], [], []);

    await expect(settleStaffPeriod(account)).rejects.toThrow(/salario/i);
    expect(mockState.writes).toHaveLength(0);
  });
});
