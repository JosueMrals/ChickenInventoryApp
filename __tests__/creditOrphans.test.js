/**
 * Huérfanos entre `presales` y `credits`. Eran dos agujeros simétricos:
 *  - eliminarCredito borraba el crédito y dejaba la pre-venta en 'credit_pending'
 *    apuntando a un creditId inexistente (y trabada: createCreditFromPreSale
 *    rechaza las que ya empiezan por 'credit_').
 *  - deletePreSaleInFirestore cancelaba la venta y dejaba el crédito 'pending',
 *    inflando la cartera con la deuda de una venta que ya no existe.
 */

const mockState = { docs: {}, deletes: [], writes: [] };

const DELETE_SENTINEL = '__deleted__';

const makeCollection = (name) => ({
  doc: (id = 'auto') => ({
    path: `${name}/${id}`,
    id,
    collection: (sub) => makeCollection(`${name}/${id}/${sub}`),
  }),
});

jest.mock('@react-native-firebase/firestore', () => {
  const firestore = () => ({
    collection: makeCollection,
    runTransaction: async (fn) => fn({
      get: async (ref) => ({
        ref,
        exists: () => !!mockState.docs[ref.path],
        data: () => mockState.docs[ref.path],
      }),
      update: (ref, payload) => {
        const next = { ...mockState.docs[ref.path], ...payload };
        Object.keys(payload).forEach((k) => {
          if (payload[k] === DELETE_SENTINEL) delete next[k];
        });
        mockState.docs[ref.path] = next;
        mockState.writes.push({ path: ref.path, payload });
      },
      set: (ref, payload) => { mockState.docs[ref.path] = payload; },
      delete: (ref) => {
        delete mockState.docs[ref.path];
        mockState.deletes.push(ref.path);
      },
    }),
  });
  firestore.Timestamp = { fromDate: (d) => d };
  firestore.FieldValue = {
    serverTimestamp: () => 'ts',
    increment: (n) => ({ __increment: n }),
    arrayUnion: (v) => [v],
    delete: () => DELETE_SENTINEL,
  };
  return firestore;
});

jest.mock('../android/app/src/services/firebaseConfig', () => {
  const real = require('@react-native-firebase/firestore');
  return { firestore: real, auth: () => ({ currentUser: { uid: 'a1', email: 'admin@test.com' } }) };
});

jest.mock('@react-native-firebase/auth', () => () => ({
  currentUser: { uid: 'a1', email: 'admin@test.com' },
}));

jest.mock('../android/app/src/services/errorMonitoring', () => ({ captureError: jest.fn() }));

const { eliminarCredito } = require('../android/app/src/screens/credits/services/creditsService');
const { deletePreSaleInFirestore } = require('../android/app/src/services/preSaleService');

const credit = (o = {}) => ({ total: 100, paid: 0, pending: 100, status: 'pending', preSaleId: 'ps-1', ...o });
const presale = (o = {}) => ({
  status: 'credit_pending',
  creditId: 'cred-1',
  paymentMethod: 'credit',
  items: [],
  bonuses: [],
  inventoryDeducted: false,
  ...o,
});

beforeEach(() => {
  mockState.docs = {};
  mockState.deletes = [];
  mockState.writes = [];
});

describe('eliminarCredito devuelve la pre-venta a contado', () => {
  test('borra el crédito y deja la orden utilizable', async () => {
    mockState.docs['credits/cred-1'] = credit();
    mockState.docs['presales/ps-1'] = presale();

    await eliminarCredito('cred-1');

    expect(mockState.deletes).toContain('credits/cred-1');
    const ps = mockState.docs['presales/ps-1'];
    expect(ps.status).toBe('pending');       // ya no 'credit_pending'
    expect(ps.paymentMethod).toBe('cash');
    expect(ps.creditId).toBeUndefined();     // sin puntero colgando
    expect(ps.creditDueDate).toBeNull();
  });

  test.each([
    ['credit_preparing', 'preparing'],
    ['credit_ready_for_delivery', 'ready_for_delivery'],
  ])('desde %s vuelve a %s', async (from, to) => {
    mockState.docs['credits/cred-1'] = credit();
    mockState.docs['presales/ps-1'] = presale({ status: from });

    await eliminarCredito('cred-1');

    expect(mockState.docs['presales/ps-1'].status).toBe(to);
  });

  test('un crédito con abonos no se puede eliminar', async () => {
    mockState.docs['credits/cred-1'] = credit({ paid: 40, pending: 60 });
    mockState.docs['presales/ps-1'] = presale();

    await expect(eliminarCredito('cred-1')).rejects.toThrow(/40\.00 abonados/);
    expect(mockState.deletes).toHaveLength(0);
    expect(mockState.docs['presales/ps-1'].status).toBe('credit_pending'); // intacta
  });

  test('si la orden ya salió de bodega, no se puede quitar el crédito', async () => {
    mockState.docs['credits/cred-1'] = credit();
    mockState.docs['presales/ps-1'] = presale({ status: 'credit_dispatched' });

    await expect(eliminarCredito('cred-1')).rejects.toThrow(/credit_dispatched/);
    expect(mockState.deletes).toHaveLength(0);
  });

  test('crédito de venta rápida (sin pre-venta): solo se borra', async () => {
    mockState.docs['credits/cred-1'] = { total: 100, paid: 0, pending: 100, status: 'pending', saleId: 'venta-9' };

    await eliminarCredito('cred-1');

    expect(mockState.deletes).toContain('credits/cred-1');
  });

  test('crédito ya borrado: no falla (reintento idempotente)', async () => {
    await expect(eliminarCredito('cred-1')).resolves.toBeUndefined();
    expect(mockState.deletes).toHaveLength(0);
  });
});

describe('cancelar la pre-venta elimina su cuenta por cobrar', () => {
  test('el crédito no queda vivo tras cancelar la venta', async () => {
    mockState.docs['credits/cred-1'] = credit();
    mockState.docs['presales/ps-1'] = presale();

    await deletePreSaleInFirestore({ preSaleId: 'ps-1', reason: 'cliente se arrepintió' });

    expect(mockState.docs['presales/ps-1'].status).toBe('cancelled');
    // Sin esto el crédito seguía 'pending' e inflaba la cartera para siempre.
    expect(mockState.deletes).toContain('credits/cred-1');
    expect(mockState.docs['credits/cred-1']).toBeUndefined();
    expect(mockState.docs['presales/ps-1'].creditId).toBeUndefined();
  });

  test('no se cancela una venta con abonos ya cobrados', async () => {
    mockState.docs['credits/cred-1'] = credit({ paid: 25, pending: 75 });
    mockState.docs['presales/ps-1'] = presale();

    await expect(
      deletePreSaleInFirestore({ preSaleId: 'ps-1', reason: 'error' })
    ).rejects.toThrow(/25\.00 abonados/);

    expect(mockState.docs['presales/ps-1'].status).toBe('credit_pending'); // sin cancelar
    expect(mockState.deletes).toHaveLength(0);
  });

  test('una venta de contado se cancela sin tocar créditos', async () => {
    mockState.docs['presales/ps-1'] = presale({ status: 'pending', creditId: undefined, paymentMethod: 'cash' });

    await deletePreSaleInFirestore({ preSaleId: 'ps-1', reason: 'duplicada' });

    expect(mockState.docs['presales/ps-1'].status).toBe('cancelled');
    expect(mockState.deletes).toHaveLength(0);
  });

  test('creditId colgando (el crédito ya no existe): la cancelación no se cae', async () => {
    mockState.docs['presales/ps-1'] = presale();

    await deletePreSaleInFirestore({ preSaleId: 'ps-1', reason: 'limpieza' });

    expect(mockState.docs['presales/ps-1'].status).toBe('cancelled');
  });
});
