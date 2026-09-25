/**
 * ExpenseReviewScreen — lista de gastos PENDING para revisión de admin, con
 * filtros por categoría/usuario/fecha (client-side, sin índices nuevos).
 * FASE E6.1.
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb) => require('react').useEffect(cb, []),
}));

const mockGetPendingExpensesForReview = jest.fn();
jest.mock('../../android/app/src/screens/expenses/services/expenseService', () => {
  const actual = jest.requireActual('../../android/app/src/screens/expenses/services/expenseService');
  return {
    ...actual,
    getPendingExpensesForReview: (...args) => mockGetPendingExpensesForReview(...args),
  };
});

const mockOnUsersSnapshot = jest.fn();
jest.mock('../../android/app/src/screens/users/services/userService', () => ({
  onUsersSnapshot: (...args) => mockOnUsersSnapshot(...args),
}));

import ExpenseReviewScreen from '../../android/app/src/screens/expenses/screens/ExpenseReviewScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };
const route = { params: { role: 'admin' } };

const pendingExpense = (overrides) => ({
  id: 'e1', category: 'FUEL', amount: 500, paymentMethod: 'CASH',
  status: 'PENDING', createdByUid: 'u1', createdAt: null, ...overrides,
});

beforeEach(() => {
  mockGetPendingExpensesForReview.mockReset();
  mockGetPendingExpensesForReview.mockResolvedValue([]);
  mockOnUsersSnapshot.mockReset();
  mockOnUsersSnapshot.mockImplementation((cb) => {
    cb([{ id: 'u1', nombre: 'Ana', apellido: 'Pérez' }, { id: 'u2', nombre: 'Beto', apellido: 'Gómez' }]);
    return () => {};
  });
  navigation.navigate.mockClear();
});

test('lista los gastos PENDING devueltos por getPendingExpensesForReview', async () => {
  mockGetPendingExpensesForReview.mockResolvedValue([
    pendingExpense({ id: 'e1', category: 'FUEL', createdByUid: 'u1' }),
    pendingExpense({ id: 'e2', category: 'FOOD', createdByUid: 'u2' }),
  ]);

  const { findAllByText } = render(<ExpenseReviewScreen navigation={navigation} route={route} />);
  // Cada etiqueta aparece dos veces: una como chip de filtro, otra como fila
  // (el chip renderiza de inmediato; hay que esperar a que la fila cargue).
  await waitFor(async () => expect((await findAllByText('Combustible')).length).toBe(2));
  expect((await findAllByText('Alimentación')).length).toBe(2);
  expect((await findAllByText('Ana Pérez')).length).toBe(2);
  expect((await findAllByText('Beto Gómez')).length).toBe(2);
});

test('sin gastos pendientes: muestra el estado vacío', async () => {
  const { findByText } = render(<ExpenseReviewScreen navigation={navigation} route={route} />);
  expect(await findByText('No hay gastos pendientes de revisión.')).toBeTruthy();
});

test('el filtro de categoría reduce la lista', async () => {
  mockGetPendingExpensesForReview.mockResolvedValue([
    pendingExpense({ id: 'e1', category: 'FUEL', createdByUid: 'u1' }),
    pendingExpense({ id: 'e2', category: 'FOOD', createdByUid: 'u2' }),
  ]);

  const { findAllByText } = render(<ExpenseReviewScreen navigation={navigation} route={route} />);
  await findAllByText('Ana Pérez');

  // Los chips de categoría se listan primero en el árbol; el de "Combustible" es
  // el primer nodo con ese texto (el segundo es la fila, que desaparece al filtrar).
  const fuelChips = await findAllByText('Combustible');
  fireEvent.press(fuelChips[0]);

  // La fila de Beto (FOOD) desaparece; su chip de usuario sigue existiendo, así
  // que se verifica por conteo, no por ausencia total del texto.
  await waitFor(async () => expect((await findAllByText('Beto Gómez')).length).toBe(1));
  expect((await findAllByText('Ana Pérez')).length).toBe(2);
});

test('el filtro de usuario reduce la lista', async () => {
  mockGetPendingExpensesForReview.mockResolvedValue([
    pendingExpense({ id: 'e1', category: 'FUEL', createdByUid: 'u1' }),
    pendingExpense({ id: 'e2', category: 'FOOD', createdByUid: 'u2' }),
  ]);

  const { findByText, findAllByText } = render(<ExpenseReviewScreen navigation={navigation} route={route} />);
  await findByText('Combustible');
  expect((await findAllByText('Beto Gómez')).length).toBe(2); // chip + fila, antes de filtrar

  const anaChips = await findAllByText('Ana Pérez');
  fireEvent.press(anaChips[0]);

  await waitFor(async () => expect((await findAllByText('Beto Gómez')).length).toBe(1));
});

test('tocar un gasto navega a ExpenseDetail con el role de admin', async () => {
  mockGetPendingExpensesForReview.mockResolvedValue([pendingExpense({ id: 'e1', createdByUid: 'u1' })]);

  const { findByText } = render(<ExpenseReviewScreen navigation={navigation} route={route} />);
  fireEvent.press(await findByText('C$500.00'));

  expect(navigation.navigate).toHaveBeenCalledWith('ExpenseDetail', { expenseId: 'e1', role: 'admin' });
});
