/**
 * CartDrawer: el cobro del carrito.
 * Antes de este test, "Confirmar" reventaba con ReferenceError (finalTotal no
 * existía) y el descuento manual de venta nunca se aplicaba al total cobrado.
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');

const mockRegister = jest.fn().mockResolvedValue('sale-1');
jest.mock('../../android/app/src/screens/quicksalesNew/services/quickSaleService', () => ({
  registerQuickSaleFull: (...args) => mockRegister(...args),
}));

// Deuda vigente del cliente: por defecto 0 (no debe nada). Los tests que prueban
// el tope acumulado la suben; `null` simula no haber podido verificarla.
const mockOutstanding = { value: 0 };
jest.mock('../../android/app/src/screens/credits/services/creditsService', () => ({
  getCustomerOutstandingCredit: async () => mockOutstanding.value,
}));

import CartDrawer from '../../android/app/src/screens/sales/components/CartDrawer';

// Carrito: 10 unidades a C$10 = C$100 de subtotal.
const cart = {
  totals: {
    items: [
      {
        productId: 'p1',
        product: { id: 'p1', name: 'Pollo entero' },
        qty: 10,
        unitPrice: 10,
        priceApplied: 10,
        subtotal: 100,
      },
    ],
    subtotal: 100,
    total: 100,
    count: 10,
  },
};

const customer = {
  id: 'c1',
  firstName: 'Juan',
  lastName: 'Pérez',
  discount: 10, // 10% de descuento de cliente
  creditLimit: 500,
  currentCredit: 0,
};

const setup = (props = {}) =>
  render(
    <CartDrawer
      visible
      onClose={jest.fn()}
      cart={cart}
      setCartCustomer={jest.fn()}
      updateQty={jest.fn()}
      removeItem={jest.fn()}
      clearCart={jest.fn()}
      customer={customer}
      role="admin"
      onSaleComplete={jest.fn()}
      {...props}
    />,
  );

beforeEach(() => mockRegister.mockClear());

test('registra la venta con los totales del carrito (antes crasheaba)', async () => {
  const { getByText } = setup();
  // La consulta del saldo del cliente resuelve antes de que el usuario confirme.
  await act(async () => {});

  // 100 - 10% de cliente = 90
  fireEvent.press(getByText('Confirmar C$90.00'));

  await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(1));
  const payload = mockRegister.mock.calls[0][0];
  expect(payload.subtotal).toBe(100);
  expect(payload.total).toBe(90);
  expect(payload.customer).toBe(customer);
  expect(payload.cart).toEqual([
    {
      id: 'p1',
      product: cart.totals.items[0].product,
      quantity: 10,
      unitPrice: 10,
      discount: 0,
      total: 100,
      isBonus: false,
    },
  ]);
});

test('el descuento manual de venta sí baja el total cobrado', async () => {
  const { getByText, getByPlaceholderText } = setup();
  await act(async () => {});

  fireEvent.changeText(getByPlaceholderText('% descuento'), '50');

  // 90 - 50% = 45
  fireEvent.press(getByText('Confirmar C$45.00'));

  await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(1));
  expect(mockRegister.mock.calls[0][0].total).toBe(45);
});

test('sin pago suficiente y sin crédito disponible, no registra la venta', async () => {
  const { getByText } = setup({
    customer: { ...customer, creditLimit: 50 }, // pendiente 90 > 50 disponible
  });
  await act(async () => {});

  fireEvent.press(getByText('Confirmar C$90.00'));

  await waitFor(() => expect(mockRegister).not.toHaveBeenCalled());
});

// ── Tope de crédito acumulado ────────────────────────────────────────────────
// Regresión: se restaba `customer.currentCredit`, un campo que nadie escribe en
// el repo (siempre 0), así que la deuda vigente del cliente no contaba y el
// límite se podía superar en cada venta nueva.
describe('tope de crédito acumulado', () => {
  afterEach(() => { mockOutstanding.value = 0; });

  // La consulta del saldo es asíncrona; en uso real resuelve al elegir cliente,
  // mucho antes de confirmar. Aquí se espera a que asiente igual que en la app.
  const setupResuelto = async (props) => {
    const utils = setup(props);
    await act(async () => {});
    return utils;
  };

  test('la deuda vigente cuenta contra el límite: bloquea aunque la venta quepa sola', async () => {
    mockOutstanding.value = 450; // ya debe 450 de 500 de límite
    const { getByText } = await setupResuelto({ customer: { ...customer, creditLimit: 500 } });

    // Los 90 pendientes caben solos en el límite de 500, pero 450 + 90 = 540 no.
    fireEvent.press(getByText('Confirmar C$90.00'));

    await waitFor(() => expect(mockRegister).not.toHaveBeenCalled());
  });

  test('si aún hay cupo tras contar la deuda, la venta pasa', async () => {
    mockOutstanding.value = 400; // 400 + 90 = 490 ≤ 500
    const { getByText } = await setupResuelto({ customer: { ...customer, creditLimit: 500 } });

    fireEvent.press(getByText('Confirmar C$90.00'));

    await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(1));
  });

  test('sin poder verificar la deuda, no bloquea la venta que cabe en el límite', async () => {
    // Decisión de producto: sin señal se permite (validando solo el total de la
    // venta) para no frenar la ruta, en vez de bloquear el crédito.
    mockOutstanding.value = null;
    const { getByText } = await setupResuelto({ customer: { ...customer, creditLimit: 500 } });

    fireEvent.press(getByText('Confirmar C$90.00'));

    await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(1));
  });

  test('confirmar ANTES de que resuelva el saldo no se salta el tope', async () => {
    // Sin el guard de `loading`, el saldo aún sin leer se trataba como "no debe
    // nada" y la venta pasaba: el tope acumulado se saltaba con solo ir rápido.
    mockOutstanding.value = 450;
    const { getByText } = setup({ customer: { ...customer, creditLimit: 500 } });

    fireEvent.press(getByText('Confirmar C$90.00')); // sin esperar a la consulta

    await waitFor(() => expect(mockRegister).not.toHaveBeenCalled());
  });
});
