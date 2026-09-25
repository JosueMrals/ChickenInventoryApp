/**
 * ExpensesScreen — "Mis gastos" solo se alimenta con el uid del usuario
 * autenticado (nunca uno arbitrario) y los estados se renderizan con su
 * etiqueta correcta.
 */
import React from 'react';
import { render, waitFor } from '@testing-library/react-native';

jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: (cb) => require('react').useEffect(cb, []),
}));

jest.mock('@react-native-firebase/auth', () => () => ({
  currentUser: { uid: 'user-1', email: 'user1@test.com' },
}));

const mockGetMyExpenses = jest.fn().mockResolvedValue([]);
jest.mock('../../android/app/src/screens/expenses/services/expenseService', () => ({
  getMyExpenses: (...args) => mockGetMyExpenses(...args),
}));

import ExpensesScreen from '../../android/app/src/screens/expenses/screens/ExpensesScreen';

const navigation = { navigate: jest.fn(), goBack: jest.fn() };

beforeEach(() => mockGetMyExpenses.mockClear());

test('getMyExpenses se llama únicamente con el uid del usuario autenticado', async () => {
  render(<ExpensesScreen navigation={navigation} />);
  await waitFor(() => expect(mockGetMyExpenses).toHaveBeenCalledWith('user-1'));
  expect(mockGetMyExpenses).toHaveBeenCalledTimes(1);
});

test('los estados se renderizan con su etiqueta correcta', async () => {
  mockGetMyExpenses.mockResolvedValue([
    { id: 'e1', category: 'FUEL', amount: 500, paymentMethod: 'CASH', status: 'PENDING', createdAt: null },
    { id: 'e2', category: 'FOOD', amount: 300, paymentMethod: 'PERSONAL', status: 'APPROVED', createdAt: null },
    { id: 'e3', category: 'TOLL', amount: 100, paymentMethod: 'CARD', status: 'REJECTED', createdAt: null },
    { id: 'e4', category: 'OTHER', amount: 50, paymentMethod: 'TRANSFER', status: 'CANCELLED', createdAt: null },
  ]);

  const { findByText } = render(<ExpensesScreen navigation={navigation} />);

  expect(await findByText('Pendiente de revisión')).toBeTruthy();
  expect(await findByText('Aprobado')).toBeTruthy();
  expect(await findByText('Rechazado')).toBeTruthy();
  expect(await findByText('Cancelado')).toBeTruthy();
});

test('muestra el indicador de impacto en efectivo por método de pago', async () => {
  mockGetMyExpenses.mockResolvedValue([
    { id: 'e1', category: 'FUEL', amount: 500, paymentMethod: 'CASH', status: 'PENDING', createdAt: null },
    { id: 'e2', category: 'FOOD', amount: 300, paymentMethod: 'PERSONAL', status: 'PENDING', createdAt: null },
  ]);

  const { findByText } = render(<ExpensesScreen navigation={navigation} />);

  expect(await findByText('Impacta efectivo')).toBeTruthy();
  expect(await findByText('Reembolso pendiente')).toBeTruthy();
});
