/**
 * CartDrawer: el cobro del carrito.
 * Antes de este test, "Confirmar" reventaba con ReferenceError (finalTotal no
 * existía) y el descuento manual de venta nunca se aplicaba al total cobrado.
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('react-native-vector-icons/MaterialCommunityIcons', () => 'Icon');
jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');

const mockRegister = jest.fn().mockResolvedValue('sale-1');
jest.mock('../../android/app/src/screens/quicksalesNew/services/quickSaleService', () => ({
  registerQuickSaleFull: (...args) => mockRegister(...args),
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

  fireEvent.press(getByText('Confirmar C$90.00'));

  await waitFor(() => expect(mockRegister).not.toHaveBeenCalled());
});
