/**
 * Regresión: los créditos pendientes no aparecían en el módulo de Créditos.
 *
 * Una pre-venta a crédito marcaba la preventa como 'credit_pending' pero NUNCA
 * creaba el documento en `credits`. La pestaña "Crédito" de Mis Pre-Ventas sí los
 * mostraba (lee `presales`), mientras que Créditos e Historial salían vacíos
 * (leen `credits`). Y no había forma de repararlo después: createCreditFromPreSale
 * rechaza toda preventa cuyo estado ya empieza por 'credit_'.
 *
 * Aquí se fija que la cuenta por cobrar nace junto con la pre-venta, en la misma
 * transacción, y que al editar el monto el crédito lo sigue.
 */

const mockState = { writes: [], deletes: [], docs: {}, seq: 0 };

jest.mock('@react-native-firebase/firestore', () => {
  const makeRef = (path, id) => ({ id, path, collection: () => makeCollection(`${path}/${id}`) });
  const makeCollection = (path) => ({
    doc: (id) => makeRef(path, id || `auto-${++mockState.seq}`),
    where: function () { return this; },
    limit: function () { return this; },
    orderBy: function () { return this; },
    get: async () => ({ empty: true, docs: [] }),
  });

  const firestore = () => ({
    collection: makeCollection,
    runTransaction: async (fn) => fn({
      get: async (ref) => ({
        ref,
        exists: () => !!mockState.docs[ref.id],
        data: () => mockState.docs[ref.id],
      }),
      set: (ref, data) => mockState.writes.push({ op: 'set', path: ref.path, id: ref.id, data }),
      update: (ref, data) => mockState.writes.push({ op: 'update', path: ref.path, id: ref.id, data }),
      delete: (ref) => mockState.deletes.push({ path: ref.path, id: ref.id }),
    }),
  });
  firestore.FieldValue = {
    serverTimestamp: () => 'ts',
    increment: (n) => n,
    delete: () => '__deleted__',
  };
  firestore.Timestamp = {
    now: () => 'ts',
    fromDate: (d) => ({ __date: d }),
  };
  return firestore;
});

jest.mock('@react-native-firebase/auth', () => () => ({
  currentUser: { uid: 'vendedor-1', email: 'vendedor@test.com' },
}));

jest.mock('../android/app/src/utils/customerUtils', () => ({
  buildCustomerName: (c) => `${c?.firstName || ''} ${c?.lastName || ''}`.trim() || 'Cliente sin nombre',
}));

const preSaleService = require('../android/app/src/services/preSaleService');

const creditWrites = () => mockState.writes.filter((w) => w.path === 'credits');
const presaleWrites = () => mockState.writes.filter((w) => w.path === 'presales');

beforeEach(() => {
  mockState.writes = [];
  mockState.deletes = [];
  mockState.docs = {};
  mockState.seq = 0;
});

// El carrito lleva el producto anidado: mapItemsToPayload lo desestructura.
const cartLine = (total, quantity = 2) => ({
  id: 'p1',
  quantity,
  unitPrice: 50,
  total,
  product: { id: 'p1', name: 'Pollo', category: 'Aves', purchasePrice: 30 },
});

describe('pre-venta a crédito → cuenta por cobrar', () => {
  const cart = [cartLine(100)];

  // validateStockAvailability lee el producto dentro de la transacción.
  beforeEach(() => { mockState.docs.p1 = { stock: 100, name: 'Pollo' }; });

  it('crea el documento en `credits` junto con la pre-venta', async () => {
    await preSaleService.savePreSaleToFirestore({
      customer: { id: 'c1', firstName: 'Ana', lastName: 'Ruiz' },
      cart,
      subtotal: 100,
      totalDiscount: 0,
      total: 100,
      paymentMethod: 'credit',
      creditDueDate: new Date('2026-08-15'),
      route: { id: 'r1', name: 'Ruta 1' },
    });

    const credit = creditWrites()[0];
    expect(credit).toBeDefined();
    expect(credit.data).toMatchObject({
      customerId: 'c1',
      total: 100,
      paid: 0,
      pending: 100,
      status: 'pending',   // así lo encuentra fetchCredits(status='pending')
    });

    // La preventa queda enlazada al crédito para que el cobro lo actualice
    // en vez de crear un duplicado.
    const presale = presaleWrites()[0];
    expect(presale.data.status).toBe('credit_pending');
    expect(presale.data.creditId).toBe(credit.id);
  });

  it('una pre-venta de contado NO crea crédito', async () => {
    await preSaleService.savePreSaleToFirestore({
      customer: { id: 'c1', firstName: 'Ana', lastName: 'Ruiz' },
      cart,
      subtotal: 100,
      totalDiscount: 0,
      total: 100,
      paymentMethod: 'cash',
      route: { id: 'r1', name: 'Ruta 1' },
    });

    expect(creditWrites()).toHaveLength(0);
    expect(presaleWrites()[0].data.creditId).toBeUndefined();
  });
});

describe('edición de una pre-venta a crédito', () => {
  const oldData = {
    status: 'credit_pending',
    paymentMethod: 'credit',
    creditId: 'cred-1',
    total: 100,
    items: [],
    bonuses: [],
    inventoryDeducted: false,
  };
  const newData = (total, paymentMethod = 'credit') => ({
    customer: { id: 'c1', firstName: 'Ana', lastName: 'Ruiz' },
    cart: [cartLine(total, 3)],
    subtotal: total,
    totalDiscount: 0,
    total,
    paymentMethod,
    creditDueDate: new Date('2026-08-20'),
  });

  // La edición relee la pre-venta dentro de la transacción: debe existir en el
  // "servidor" del mock.
  beforeEach(() => { mockState.docs['ps-1'] = { ...oldData }; });

  it('al cambiar el monto, el crédito sigue a la pre-venta', async () => {
    mockState.docs['cred-1'] = { total: 100, paid: 0, pending: 100, status: 'pending' };

    await preSaleService.updatePreSaleInFirestore('ps-1', oldData, newData(150));

    const credit = mockState.writes.find((w) => w.id === 'cred-1');
    expect(credit.data).toMatchObject({ total: 150, pending: 150 });
  });

  it('con abonos aplicados, el pendiente descuenta lo ya pagado', async () => {
    mockState.docs['cred-1'] = { total: 100, paid: 40, pending: 60, status: 'pending' };

    await preSaleService.updatePreSaleInFirestore('ps-1', oldData, newData(150));

    const credit = mockState.writes.find((w) => w.id === 'cred-1');
    expect(credit.data).toMatchObject({ total: 150, pending: 110 });
  });

  it('rechaza bajar el total por debajo de lo ya abonado', async () => {
    mockState.docs['cred-1'] = { total: 100, paid: 80, pending: 20, status: 'pending' };

    await expect(
      preSaleService.updatePreSaleInFirestore('ps-1', oldData, newData(50))
    ).rejects.toThrow(/abonado/);
  });

  it('pasar a contado elimina el crédito si no tiene abonos', async () => {
    mockState.docs['cred-1'] = { total: 100, paid: 0, pending: 100, status: 'pending' };

    await preSaleService.updatePreSaleInFirestore('ps-1', oldData, newData(100, 'cash'));

    expect(mockState.deletes.map((d) => d.id)).toContain('cred-1');
  });

  it('pasar a contado con abonos aplicados se rechaza', async () => {
    mockState.docs['cred-1'] = { total: 100, paid: 30, pending: 70, status: 'pending' };

    await expect(
      preSaleService.updatePreSaleInFirestore('ps-1', oldData, newData(100, 'cash'))
    ).rejects.toThrow(/abonados/);
    expect(mockState.deletes).toHaveLength(0);
  });

  // Regresión: facturas ya cobradas/entregadas reaparecían como PENDIENTES.
  // La pantalla del vendedor traía la pre-venta de una caché vieja (aún editable);
  // al guardar, la escritura pisaba el estado real del servidor y la factura
  // "revivía". El estado que decide es el RELEÍDO dentro de la transacción.
  it('rechaza editar una pre-venta que el servidor ya tiene cobrada', async () => {
    mockState.docs['ps-1'] = { ...oldData, status: 'paid' };
    mockState.docs['cred-1'] = { total: 100, paid: 100, pending: 0, status: 'paid' };

    await expect(
      preSaleService.updatePreSaleInFirestore('ps-1', oldData, newData(150))
    ).rejects.toThrow(/paid/);
    expect(presaleWrites()).toHaveLength(0);
  });

  it('rechaza editar una pre-venta con devolución aprobada en el servidor', async () => {
    mockState.docs['ps-1'] = { ...oldData, status: 'partially_returned' };
    mockState.docs['cred-1'] = { total: 100, paid: 0, pending: 100, status: 'pending' };

    await expect(
      preSaleService.updatePreSaleInFirestore('ps-1', oldData, newData(150))
    ).rejects.toThrow(/partially_returned/);
    expect(presaleWrites()).toHaveLength(0);
  });
});
