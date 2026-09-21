/**
 * ExpenseDetailScreen — la cancelación usa canCancelExpense() como única
 * fuente de verdad (no se duplica esa lógica en la UI): el botón "Cancelar
 * gasto" solo aparece cuando esa función real dice que sí se puede.
 */
import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';

jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb) => require('react').useEffect(cb, []),
}));

// react-test-renderer no soporta el <Modal> nativo de RN (ningún otro test del
// repo lo renderiza todavía) — se mockea el componente completo, mismo
// criterio que Ionicons: un stand-in mínimo, no una réplica de su UI interna.
jest.mock('../../android/app/src/screens/expenses/components/PayReimbursementModal', () => {
  const ReactActual = require('react');
  const { TouchableOpacity, Text } = require('react-native');
  return function MockPayReimbursementModal({ visible, onSubmit }) {
    if (!visible) return null;
    return ReactActual.createElement(
      TouchableOpacity,
      { onPress: () => onSubmit({ paymentMethod: 'CASH', reference: null, notes: null }) },
      ReactActual.createElement(Text, null, 'Confirmar pago (mock)')
    );
  };
});

jest.mock('@react-native-firebase/auth', () => () => ({
  currentUser: { uid: 'user-1', email: 'user1@test.com' },
}));

const mockGetExpense = jest.fn();
const mockCancelExpense = jest.fn().mockResolvedValue(undefined);
const mockReviewExpense = jest.fn().mockResolvedValue(undefined);
jest.mock('../../android/app/src/screens/expenses/services/expenseService', () => {
  const actual = jest.requireActual('../../android/app/src/screens/expenses/services/expenseService');
  return {
    ...actual,
    getExpense: (...args) => mockGetExpense(...args),
    cancelExpense: (...args) => mockCancelExpense(...args),
    reviewExpense: (...args) => mockReviewExpense(...args),
  };
});

const mockGetReimbursement = jest.fn().mockResolvedValue(null);
const mockPayReimbursement = jest.fn().mockResolvedValue(undefined);
jest.mock('../../android/app/src/screens/expenses/services/reimbursementService', () => {
  const actual = jest.requireActual('../../android/app/src/screens/expenses/services/reimbursementService');
  return {
    ...actual,
    getReimbursement: (...args) => mockGetReimbursement(...args),
    payReimbursement: (...args) => mockPayReimbursement(...args),
  };
});

import ExpenseDetailScreen from '../../android/app/src/screens/expenses/screens/ExpenseDetailScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };
const route = { params: { expenseId: 'e1' } };

beforeEach(() => {
  mockGetExpense.mockReset();
  mockCancelExpense.mockClear();
  mockReviewExpense.mockClear();
  mockGetReimbursement.mockReset();
  mockGetReimbursement.mockResolvedValue(null);
  mockPayReimbursement.mockClear();
});

test('gasto PENDING sin cierre asignado, del propio usuario: muestra botón Cancelar', async () => {
  mockGetExpense.mockResolvedValue({
    id: 'e1', createdByUid: 'user-1', status: 'PENDING', cashClosingId: null,
    category: 'FUEL', amount: 500, paymentMethod: 'CASH', receipt: {}, createdAt: null,
  });

  const { findByText } = render(<ExpenseDetailScreen navigation={navigation} route={route} />);
  expect(await findByText('Cancelar gasto')).toBeTruthy();
});

test('gasto APPROVED: NO muestra botón Cancelar (canCancelExpense lo prohíbe)', async () => {
  mockGetExpense.mockResolvedValue({
    id: 'e1', createdByUid: 'user-1', status: 'APPROVED', cashClosingId: null,
    category: 'FUEL', amount: 500, paymentMethod: 'CASH', receipt: {}, createdAt: null,
  });

  const { queryByText, findByText } = render(<ExpenseDetailScreen navigation={navigation} route={route} />);
  await findByText('Aprobado'); // espera a que cargue
  expect(queryByText('Cancelar gasto')).toBeNull();
});

test('gasto ya vinculado a un cierre: NO muestra botón Cancelar, sí el aviso de liquidación', async () => {
  mockGetExpense.mockResolvedValue({
    id: 'e1', createdByUid: 'user-1', status: 'PENDING', cashClosingId: 'closing-1',
    category: 'FUEL', amount: 500, paymentMethod: 'CASH', receipt: {}, createdAt: null,
  });

  const { queryByText, findByText } = render(<ExpenseDetailScreen navigation={navigation} route={route} />);
  expect(await findByText('Este gasto ya fue incluido en una liquidación.')).toBeTruthy();
  expect(queryByText('Cancelar gasto')).toBeNull();
});

test('confirmar cancelación llama a cancelExpense con el id y uid correctos', async () => {
  mockGetExpense.mockResolvedValue({
    id: 'e1', createdByUid: 'user-1', status: 'PENDING', cashClosingId: null,
    category: 'FUEL', amount: 500, paymentMethod: 'CASH', receipt: {}, createdAt: null,
  });
  // Simula al usuario tocando el botón destructivo del Alert de confirmación.
  jest.spyOn(require('react-native').Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
    const confirm = buttons.find((b) => b.style === 'destructive');
    confirm.onPress();
  });

  const { findByText } = render(<ExpenseDetailScreen navigation={navigation} route={route} />);
  const cancelBtn = await findByText('Cancelar gasto');

  await act(async () => {
    fireEvent.press(cancelBtn);
  });

  await waitFor(() => expect(mockCancelExpense).toHaveBeenCalledWith('e1', 'user-1'));
});

// FASE E6.1 — revisión administrativa y estados del reembolso.
describe('revisión administrativa (FASE E6.1)', () => {
  test('admin viendo un gasto PENDING: muestra Aprobar y Rechazar', async () => {
    mockGetExpense.mockResolvedValue({
      id: 'e1', createdByUid: 'other-user', status: 'PENDING', cashClosingId: null,
      category: 'FUEL', amount: 500, paymentMethod: 'CASH', receipt: {}, createdAt: null,
    });

    const { findByText } = render(
      <ExpenseDetailScreen navigation={navigation} route={{ params: { expenseId: 'e1', role: 'admin' } }} />
    );
    expect(await findByText('Aprobar gasto')).toBeTruthy();
    expect(await findByText('Rechazar gasto')).toBeTruthy();
  });

  test('usuario no-admin: NUNCA ve Aprobar/Rechazar aunque el gasto esté PENDING', async () => {
    mockGetExpense.mockResolvedValue({
      id: 'e1', createdByUid: 'user-1', status: 'PENDING', cashClosingId: null,
      category: 'FUEL', amount: 500, paymentMethod: 'CASH', receipt: {}, createdAt: null,
    });

    const { queryByText, findByText } = render(<ExpenseDetailScreen navigation={navigation} route={route} />);
    await findByText('Cancelar gasto');
    expect(queryByText('Aprobar gasto')).toBeNull();
    expect(queryByText('Rechazar gasto')).toBeNull();
  });

  test('admin viendo un gasto ya APPROVED: NO muestra Aprobar (canReviewExpense lo prohíbe)', async () => {
    mockGetExpense.mockResolvedValue({
      id: 'e1', createdByUid: 'other-user', status: 'APPROVED', cashClosingId: null,
      category: 'FUEL', amount: 500, paymentMethod: 'CASH', receipt: {}, createdAt: null,
    });

    const { queryByText, findByText } = render(
      <ExpenseDetailScreen navigation={navigation} route={{ params: { expenseId: 'e1', role: 'admin' } }} />
    );
    await findByText('Aprobado');
    expect(queryByText('Aprobar gasto')).toBeNull();
  });

  test('confirmar Aprobar llama a reviewExpense con APPROVED', async () => {
    mockGetExpense.mockResolvedValue({
      id: 'e1', createdByUid: 'other-user', status: 'PENDING', cashClosingId: null,
      category: 'FUEL', amount: 500, paymentMethod: 'PERSONAL', receipt: {}, createdAt: null,
    });
    jest.spyOn(require('react-native').Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      buttons.find((b) => b.text === 'Sí, aprobar').onPress();
    });

    const { findByText } = render(
      <ExpenseDetailScreen navigation={navigation} route={{ params: { expenseId: 'e1', role: 'admin' } }} />
    );
    const approveBtn = await findByText('Aprobar gasto');
    await act(async () => { fireEvent.press(approveBtn); });

    await waitFor(() => expect(mockReviewExpense).toHaveBeenCalledWith('e1', 'APPROVED', 'user-1'));
  });

  test('confirmar Rechazar llama a reviewExpense con REJECTED', async () => {
    mockGetExpense.mockResolvedValue({
      id: 'e1', createdByUid: 'other-user', status: 'PENDING', cashClosingId: null,
      category: 'FUEL', amount: 500, paymentMethod: 'PERSONAL', receipt: {}, createdAt: null,
    });
    jest.spyOn(require('react-native').Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      buttons.find((b) => b.text === 'Sí, rechazar').onPress();
    });

    const { findByText } = render(
      <ExpenseDetailScreen navigation={navigation} route={{ params: { expenseId: 'e1', role: 'admin' } }} />
    );
    const rejectBtn = await findByText('Rechazar gasto');
    await act(async () => { fireEvent.press(rejectBtn); });

    await waitFor(() => expect(mockReviewExpense).toHaveBeenCalledWith('e1', 'REJECTED', 'user-1'));
  });
});

// FASE E6.3.1 — rechazar un gasto que ya fue APPROVED.
describe('rechazo posterior a la aprobación (FASE E6.3.1)', () => {
  const approvedRoute = { params: { expenseId: 'e1', role: 'admin' } };

  test('admin viendo un gasto APPROVED: muestra Rechazar, no Aprobar', async () => {
    mockGetExpense.mockResolvedValue({
      id: 'e1', createdByUid: 'other-user', status: 'APPROVED', cashClosingId: null,
      category: 'FUEL', amount: 500, paymentMethod: 'CASH', receipt: {}, createdAt: null,
    });

    const { findByText, queryByText } = render(<ExpenseDetailScreen navigation={navigation} route={approvedRoute} />);
    expect(await findByText('Rechazar gasto')).toBeTruthy();
    expect(queryByText('Aprobar gasto')).toBeNull();
  });

  test('usuario no-admin: nunca ve Rechazar aunque el gasto esté APPROVED', async () => {
    mockGetExpense.mockResolvedValue({
      id: 'e1', createdByUid: 'user-1', status: 'APPROVED', cashClosingId: null,
      category: 'FUEL', amount: 500, paymentMethod: 'CASH', receipt: {}, createdAt: null,
    });

    const { queryByText, findByText } = render(<ExpenseDetailScreen navigation={navigation} route={route} />);
    await findByText('Aprobado');
    expect(queryByText('Rechazar gasto')).toBeNull();
  });

  test('gasto REJECTED: no muestra ni Aprobar ni Rechazar (terminal)', async () => {
    mockGetExpense.mockResolvedValue({
      id: 'e1', createdByUid: 'other-user', status: 'REJECTED', cashClosingId: null,
      category: 'FUEL', amount: 500, paymentMethod: 'CASH', receipt: {}, createdAt: null,
    });

    const { queryByText, findByText } = render(<ExpenseDetailScreen navigation={navigation} route={approvedRoute} />);
    await findByText('Rechazado');
    expect(queryByText('Aprobar gasto')).toBeNull();
    expect(queryByText('Rechazar gasto')).toBeNull();
  });

  test('confirmar Rechazar sobre un APPROVED llama a reviewExpense con REJECTED', async () => {
    mockGetExpense.mockResolvedValue({
      id: 'e1', createdByUid: 'other-user', status: 'APPROVED', cashClosingId: null,
      category: 'FUEL', amount: 500, paymentMethod: 'CASH', receipt: {}, createdAt: null,
    });
    jest.spyOn(require('react-native').Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      buttons.find((b) => b.text === 'Sí, rechazar').onPress();
    });

    const { findByText } = render(<ExpenseDetailScreen navigation={navigation} route={approvedRoute} />);
    const rejectBtn = await findByText('Rechazar gasto');
    await act(async () => { fireEvent.press(rejectBtn); });

    await waitFor(() => expect(mockReviewExpense).toHaveBeenCalledWith('e1', 'REJECTED', 'user-1'));
  });

  test('advertencia genérica al rechazar un APPROVED sin reembolso pagado (CASH)', async () => {
    mockGetExpense.mockResolvedValue({
      id: 'e1', createdByUid: 'other-user', status: 'APPROVED', cashClosingId: null,
      category: 'FUEL', amount: 500, paymentMethod: 'CASH', receipt: {}, createdAt: null,
    });
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});

    const { findByText } = render(<ExpenseDetailScreen navigation={navigation} route={approvedRoute} />);
    fireEvent.press(await findByText('Rechazar gasto'));

    const lastCall = alertSpy.mock.calls[alertSpy.mock.calls.length - 1];
    expect(lastCall[1]).toBe('El gasto ya fue aprobado.\n\n¿Rechazar este gasto?');
  });

  test('advertencia específica al rechazar un PERSONAL con reembolso ya PAGADO', async () => {
    mockGetExpense.mockResolvedValue({
      id: 'e1', createdByUid: 'other-user', status: 'APPROVED', cashClosingId: null,
      category: 'FOOD', amount: 300, paymentMethod: 'PERSONAL', receipt: {}, createdAt: null,
    });
    mockGetReimbursement.mockResolvedValue({ id: 'e1', status: 'PAID', amount: 300, paymentMethod: 'CASH' });
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});

    const { findByText } = render(<ExpenseDetailScreen navigation={navigation} route={approvedRoute} />);
    fireEvent.press(await findByText('Rechazar gasto'));

    const lastCall = alertSpy.mock.calls[alertSpy.mock.calls.length - 1];
    expect(lastCall[1]).toBe(
      'Este gasto ya fue reembolsado.\n\nAl rechazarlo se generará una deuda por el monto reembolsado para su posterior recuperación.\n\n¿Rechazar este gasto?'
    );
  });

  test('advertencia intermedia al rechazar un PERSONAL con reembolso aún PENDING', async () => {
    mockGetExpense.mockResolvedValue({
      id: 'e1', createdByUid: 'other-user', status: 'APPROVED', cashClosingId: null,
      category: 'FOOD', amount: 300, paymentMethod: 'PERSONAL', receipt: {}, createdAt: null,
    });
    mockGetReimbursement.mockResolvedValue({ id: 'e1', status: 'PENDING', amount: 300 });
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation(() => {});

    const { findByText } = render(<ExpenseDetailScreen navigation={navigation} route={approvedRoute} />);
    fireEvent.press(await findByText('Rechazar gasto'));

    const lastCall = alertSpy.mock.calls[alertSpy.mock.calls.length - 1];
    expect(lastCall[1]).toBe(
      'El gasto ya fue aprobado.\nSi el reembolso ya fue pagado, el monto deberá ser recuperado posteriormente.\n\n¿Rechazar este gasto?'
    );
  });
});

describe('estados del reembolso (FASE E6.1)', () => {
  const personalExpense = (status) => ({
    id: 'e1', createdByUid: 'user-1', status, cashClosingId: null,
    category: 'FOOD', amount: 300, paymentMethod: 'PERSONAL', receipt: {}, createdAt: null,
  });

  test('gasto PERSONAL todavía PENDING: sin reembolso creado todavía (reviewExpense no lo ha generado)', async () => {
    mockGetExpense.mockResolvedValue(personalExpense('PENDING'));
    mockGetReimbursement.mockResolvedValue(null);

    const { findByText } = render(<ExpenseDetailScreen navigation={navigation} route={route} />);
    expect(await findByText('Sin reembolso todavía (el gasto sigue en revisión)')).toBeTruthy();
  });

  test('reembolso PENDING (gasto APPROVED): muestra "Reembolso pendiente"', async () => {
    mockGetExpense.mockResolvedValue(personalExpense('APPROVED'));
    mockGetReimbursement.mockResolvedValue({ id: 'e1', status: 'PENDING', amount: 300 });

    const { findByText } = render(<ExpenseDetailScreen navigation={navigation} route={route} />);
    expect(await findByText(/Reembolso pendiente/)).toBeTruthy();
    expect(mockGetReimbursement).toHaveBeenCalledWith('e1');
  });

  test('reembolso CANCELLED (gasto REJECTED): muestra "Reembolso cancelado"', async () => {
    mockGetExpense.mockResolvedValue(personalExpense('REJECTED'));
    mockGetReimbursement.mockResolvedValue({ id: 'e1', status: 'CANCELLED', amount: 300 });

    const { findByText } = render(<ExpenseDetailScreen navigation={navigation} route={route} />);
    expect(await findByText(/Reembolso cancelado/)).toBeTruthy();
  });

  test('reembolso PAID: muestra "Reembolso pagado"', async () => {
    mockGetExpense.mockResolvedValue(personalExpense('APPROVED'));
    mockGetReimbursement.mockResolvedValue({ id: 'e1', status: 'PAID', amount: 300 });

    const { findByText } = render(<ExpenseDetailScreen navigation={navigation} route={route} />);
    expect(await findByText(/Reembolso pagado/)).toBeTruthy();
  });

  test('gasto CASH: nunca consulta reimbursements ni muestra la sección', async () => {
    mockGetExpense.mockResolvedValue({
      id: 'e1', createdByUid: 'user-1', status: 'APPROVED', cashClosingId: null,
      category: 'FUEL', amount: 500, paymentMethod: 'CASH', receipt: {}, createdAt: null,
    });

    const { queryByText, findByText } = render(<ExpenseDetailScreen navigation={navigation} route={route} />);
    await findByText('Aprobado');
    expect(queryByText('Reembolso')).toBeNull();
    expect(mockGetReimbursement).not.toHaveBeenCalled();
  });
});

// FASE E6.2 — pago del reembolso.
describe('pago de reembolso (FASE E6.2)', () => {
  const approvedPersonal = () => ({
    id: 'e1', createdByUid: 'other-user', status: 'APPROVED', cashClosingId: null,
    category: 'FUEL', amount: 500, paymentMethod: 'PERSONAL', receipt: {}, createdAt: null,
  });
  const adminRoute = { params: { expenseId: 'e1', role: 'admin' } };

  test('admin con reembolso PENDING: muestra "Marcar como pagado"', async () => {
    mockGetExpense.mockResolvedValue(approvedPersonal());
    mockGetReimbursement.mockResolvedValue({ id: 'e1', status: 'PENDING', amount: 500 });

    const { findByText } = render(<ExpenseDetailScreen navigation={navigation} route={adminRoute} />);
    expect(await findByText('Marcar como pagado')).toBeTruthy();
  });

  test('usuario no-admin: NUNCA ve "Marcar como pagado" aunque el reembolso esté PENDING', async () => {
    mockGetExpense.mockResolvedValue(approvedPersonal());
    mockGetReimbursement.mockResolvedValue({ id: 'e1', status: 'PENDING', amount: 500 });

    const { queryByText, findByText } = render(<ExpenseDetailScreen navigation={navigation} route={route} />);
    await findByText(/Reembolso pendiente/);
    expect(queryByText('Marcar como pagado')).toBeNull();
  });

  test('reembolso ya PAID: NO muestra "Marcar como pagado"', async () => {
    mockGetExpense.mockResolvedValue(approvedPersonal());
    mockGetReimbursement.mockResolvedValue({ id: 'e1', status: 'PAID', amount: 500, paymentMethod: 'CASH' });

    const { queryByText, findByText } = render(<ExpenseDetailScreen navigation={navigation} route={adminRoute} />);
    await findByText(/Reembolso pagado/);
    expect(queryByText('Marcar como pagado')).toBeNull();
  });

  test('confirmar el pago (modal + Alert) llama a payReimbursement con expenseId, datos y paidByUid', async () => {
    mockGetExpense.mockResolvedValue(approvedPersonal());
    mockGetReimbursement.mockResolvedValue({ id: 'e1', status: 'PENDING', amount: 500 });
    jest.spyOn(require('react-native').Alert, 'alert').mockImplementation((_title, _msg, buttons) => {
      buttons.find((b) => b.text === 'Confirmar').onPress();
    });

    const { findByText } = render(<ExpenseDetailScreen navigation={navigation} route={adminRoute} />);
    fireEvent.press(await findByText('Marcar como pagado'));
    // El mock de PayReimbursementModal dispara onSubmit con un pago CASH canned.
    fireEvent.press(await findByText('Confirmar pago (mock)'));

    await waitFor(() =>
      expect(mockPayReimbursement).toHaveBeenCalledWith(
        'e1',
        { paymentMethod: 'CASH', reference: null, notes: null, paidByUid: 'user-1' },
      )
    );
  });

  test('gasto CASH (no PERSONAL): nunca muestra "Marcar como pagado"', async () => {
    mockGetExpense.mockResolvedValue({
      id: 'e1', createdByUid: 'other-user', status: 'APPROVED', cashClosingId: null,
      category: 'FUEL', amount: 500, paymentMethod: 'CASH', receipt: {}, createdAt: null,
    });

    const { queryByText, findByText } = render(<ExpenseDetailScreen navigation={navigation} route={adminRoute} />);
    await findByText('Aprobado');
    expect(queryByText('Marcar como pagado')).toBeNull();
  });
});
