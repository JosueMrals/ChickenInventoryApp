/**
 * CreateExpenseScreen — validación en el formulario, mensaje de impacto por
 * método de pago, comprobante obligatorio, protección de doble envío y que
 * createExpense reciba exactamente el receipt subido. No mockea
 * validateExpenseDraft/EXPENSE_CATEGORIES/PAYMENT_METHODS (son lógica real,
 * ya cubierta por expenseServiceLogic.test.js) — solo createExpense y el
 * servicio de fotos, para aislar la UI.
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');

jest.mock('@react-native-firebase/auth', () => () => ({
  currentUser: { uid: 'user-1', email: 'user1@test.com' },
}));

const mockCreateExpense = jest.fn().mockResolvedValue('expense-1');
jest.mock('../../android/app/src/screens/expenses/services/expenseService', () => {
  const actual = jest.requireActual('../../android/app/src/screens/expenses/services/expenseService');
  return {
    ...actual,
    createExpense: (...args) => mockCreateExpense(...args),
  };
});

const mockUploadReceipt = jest.fn().mockResolvedValue({
  url: 'https://mock/receipt.jpg', path: 'expenseReceipts/user-1_1.jpg', uploadedAt: '2026-01-01T00:00:00.000Z',
});
jest.mock('../../android/app/src/screens/expenses/services/expenseReceiptsService', () => ({
  uploadExpenseReceipt: (...args) => mockUploadReceipt(...args),
  deleteExpenseReceipt: jest.fn(),
}));

const { launchImageLibrary } = require('react-native-image-picker');

import CreateExpenseScreen from '../../android/app/src/screens/expenses/screens/CreateExpenseScreen';

const setup = () => {
  const navigation = { goBack: jest.fn(), navigate: jest.fn() };
  const utils = render(<CreateExpenseScreen navigation={navigation} />);
  return { ...utils, navigation };
};

const attachReceiptViaGallery = async (getByText) => {
  launchImageLibrary.mockResolvedValueOnce({ didCancel: false, assets: [{ uri: 'file://foto.jpg' }] });
  await act(async () => {
    fireEvent.press(getByText('Galería'));
  });
  await waitFor(() => expect(mockUploadReceipt).toHaveBeenCalled());
};

beforeEach(() => {
  mockCreateExpense.mockClear();
  mockUploadReceipt.mockClear();
});

test('sin comprobante no se puede enviar el gasto (botón deshabilitado, createExpense nunca se llama)', () => {
  const { getByText, getByPlaceholderText } = setup();

  fireEvent.press(getByText('Combustible'));
  fireEvent.changeText(getByPlaceholderText('0.00'), '500');
  fireEvent.press(getByText('Efectivo'));
  // Categoría, monto y método completos, pero sin comprobante: "Guardar gasto"
  // queda deshabilitado (canSubmit=false) — el press no debe disparar nada.
  fireEvent.press(getByText('Guardar gasto'));

  expect(mockCreateExpense).not.toHaveBeenCalled();
});

test('CASH muestra el mensaje de impacto en efectivo', () => {
  const { getByText } = setup();
  fireEvent.press(getByText('Efectivo'));
  expect(getByText(/se descontará del efectivo/i)).toBeTruthy();
});

test('PERSONAL muestra el mensaje de reembolso pendiente', () => {
  const { getByText } = setup();
  fireEvent.press(getByText('Dinero personal'));
  expect(getByText(/reembolso pendiente/i)).toBeTruthy();
});

test('TRANSFER muestra que no afecta el efectivo físico', () => {
  const { getByText } = setup();
  fireEvent.press(getByText('Transferencia'));
  expect(getByText(/no afecta el efectivo físico/i)).toBeTruthy();
});

test('CARD muestra que no afecta el efectivo físico', () => {
  const { getByText } = setup();
  fireEvent.press(getByText('Tarjeta'));
  expect(getByText(/no afecta el efectivo físico/i)).toBeTruthy();
});

test('createExpense recibe exactamente el receipt subido y el createdByUid del usuario autenticado', async () => {
  const { getByText, getByPlaceholderText, navigation } = setup();

  fireEvent.press(getByText('Combustible'));
  fireEvent.changeText(getByPlaceholderText('0.00'), '500');
  fireEvent.press(getByText('Efectivo'));
  await attachReceiptViaGallery(getByText);

  fireEvent.press(getByText('Guardar gasto'));

  await waitFor(() => expect(mockCreateExpense).toHaveBeenCalledTimes(1));
  expect(mockCreateExpense).toHaveBeenCalledWith(expect.objectContaining({
    amount: 500,
    category: 'FUEL',
    paymentMethod: 'CASH',
    createdByUid: 'user-1',
    receipt: { url: 'https://mock/receipt.jpg', path: 'expenseReceipts/user-1_1.jpg', uploadedAt: '2026-01-01T00:00:00.000Z' },
  }));
  await waitFor(() => expect(navigation.goBack).toHaveBeenCalled());
});

test('doble tap en "Guardar gasto" registra el gasto una sola vez', async () => {
  let resolveCreate;
  mockCreateExpense.mockImplementation(() => new Promise((resolve) => { resolveCreate = resolve; }));

  const { getByText, getByPlaceholderText } = setup();
  fireEvent.press(getByText('Combustible'));
  fireEvent.changeText(getByPlaceholderText('0.00'), '500');
  fireEvent.press(getByText('Efectivo'));
  await attachReceiptViaGallery(getByText);

  const submitBtn = getByText('Guardar gasto');
  fireEvent.press(submitBtn);
  fireEvent.press(submitBtn);

  await act(async () => { resolveCreate('expense-1'); });

  expect(mockCreateExpense).toHaveBeenCalledTimes(1);
});
