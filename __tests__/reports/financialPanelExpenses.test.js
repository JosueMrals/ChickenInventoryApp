/**
 * FinancialPanelPRO — desglose y filtros de gastos operativos (FASE E5).
 * No dispara ninguna consulta nueva: todo se deriva de `getFinancialDetail`
 * (mismo mock que el resto de la suite de reports).
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';

jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');

const mockGetFinancialDetail = jest.fn();
jest.mock('../../android/app/src/screens/reports/services/reportsService', () => ({
  getFinancialDetail: (...args) => mockGetFinancialDetail(...args),
}));

import FinancialPanelPRO from '../../android/app/src/screens/reports/panels/FinancialPanelPRO';

const baseResult = {
  salesIncome: 1000, salesCost: 400, grossProfit: 600, grossMargin: 60, netMargin: 50,
  totalDiscounts: 0, salesCount: 5, avgPerSale: 200,
  salesSources: { sale: 800, presale: 200 },
  paymentMethods: [], timeseries: [],
  extIncomes: 0, extExpenses: 900,
  financialDocs: [
    { id: 'f1', type: 'expense', amount: 500, description: 'Gasolina', category: 'FUEL', paymentMethod: 'CASH', createdByUid: 'u1', createdByName: 'Ana Pérez', createdAt: null },
    { id: 'f2', type: 'expense', amount: 300, description: 'Almuerzo', category: 'FOOD', paymentMethod: 'PERSONAL', createdByUid: 'u2', createdByName: 'Beto Gómez', createdAt: null },
    { id: 'f3', type: 'expense', amount: 100, description: 'Peaje autopista', category: 'TOLL', paymentMethod: 'CARD', createdByUid: null, createdByName: null, createdAt: null },
  ],
  totalIncome: 1000, totalExpenses: 900, netProfit: 100,
  expenseBreakdown: {
    total: 900, count: 3,
    byCategory: { FUEL: 500, FOOD: 300, TOLL: 100 },
    byPaymentMethod: { CASH: 500, PERSONAL: 300, CARD: 100 },
  },
  expenseUsers: [
    { uid: 'u1', name: 'Ana Pérez' },
    { uid: 'u2', name: 'Beto Gómez' },
  ],
};

beforeEach(() => {
  mockGetFinancialDetail.mockReset();
  mockGetFinancialDetail.mockResolvedValue(baseResult);
});

test('muestra el desglose de gastos operativos: total, cantidad, categoría y método', async () => {
  const { findByText } = render(<FinancialPanelPRO dateFrom={new Date()} dateTo={new Date()} />);

  expect(await findByText('Gastos operativos (3)')).toBeTruthy();
  expect(await findByText('Combustible')).toBeTruthy();
  expect(await findByText('Alimentación')).toBeTruthy();
  expect(await findByText('Peaje')).toBeTruthy();
  expect(await findByText('Efectivo')).toBeTruthy();
  expect(await findByText('Dinero personal')).toBeTruthy();
});

test('distingue CASH (afecta Cash Closing) de PERSONAL (reembolso, no afecta Cash Closing)', async () => {
  const { findByText } = render(<FinancialPanelPRO dateFrom={new Date()} dateTo={new Date()} />);

  expect(await findByText('Afecta Cash Closing')).toBeTruthy();
  expect(await findByText('Genera reembolso · no afecta Cash Closing')).toBeTruthy();
  expect(await findByText('No afecta Cash Closing')).toBeTruthy();
});

test('la suma de byCategory y byPaymentMethod mostrados coincide con extExpenses (sin doble conteo)', async () => {
  render(<FinancialPanelPRO dateFrom={new Date()} dateTo={new Date()} />);
  await waitFor(() => expect(mockGetFinancialDetail).toHaveBeenCalled());

  const sumCategory = Object.values(baseResult.expenseBreakdown.byCategory).reduce((a, b) => a + b, 0);
  const sumMethod = Object.values(baseResult.expenseBreakdown.byPaymentMethod).reduce((a, b) => a + b, 0);
  expect(sumCategory).toBe(baseResult.extExpenses);
  expect(sumMethod).toBe(baseResult.extExpenses);
});

test('el filtro de categoría reduce la lista de transacciones sin cambiar el KPI de gastos', async () => {
  const { findByText, findAllByText, getByText, queryByText } = render(
    <FinancialPanelPRO dateFrom={new Date()} dateTo={new Date()} />
  );

  fireEvent.press(await findByText('Transacciones financieras (3)'));
  expect(await findByText('Gasolina')).toBeTruthy();
  expect(await findByText('Almuerzo')).toBeTruthy();

  // 'Combustible' aparece en el desglose y en el chip de filtro — el chip es el último.
  const combustibleNodes = await findAllByText('Combustible');
  fireEvent.press(combustibleNodes[combustibleNodes.length - 1]);

  await waitFor(() => expect(queryByText('Almuerzo')).toBeNull());
  expect(getByText('Gasolina')).toBeTruthy();
  // el KPI de gastos externos sigue mostrando el total real, no el filtrado
  expect((await findAllByText('C$900.00')).length).toBeGreaterThan(0);
});

test('el filtro de método de pago reduce la lista de transacciones', async () => {
  const { findByText, findAllByText, getByText, queryByText } = render(
    <FinancialPanelPRO dateFrom={new Date()} dateTo={new Date()} />
  );

  fireEvent.press(await findByText('Transacciones financieras (3)'));
  const personalNodes = await findAllByText('Dinero personal');
  fireEvent.press(personalNodes[personalNodes.length - 1]);

  await waitFor(() => expect(queryByText('Gasolina')).toBeNull());
  expect(getByText('Almuerzo')).toBeTruthy();
});

test('el filtro de usuario "Ana Pérez" muestra solo sus transacciones', async () => {
  const { findByText, getByText, queryByText } = render(
    <FinancialPanelPRO dateFrom={new Date()} dateTo={new Date()} />
  );

  fireEvent.press(await findByText('Transacciones financieras (3)'));
  expect(await findByText('Gasolina')).toBeTruthy();

  fireEvent.press(getByText('Ana Pérez'));

  await waitFor(() => expect(queryByText('Almuerzo')).toBeNull());
  expect(getByText('Gasolina')).toBeTruthy();
  expect(queryByText('Peaje autopista')).toBeNull();
});

test('el filtro de usuario "Beto Gómez" muestra solo sus transacciones', async () => {
  const { findByText, getByText, queryByText } = render(
    <FinancialPanelPRO dateFrom={new Date()} dateTo={new Date()} />
  );

  fireEvent.press(await findByText('Transacciones financieras (3)'));
  fireEvent.press(getByText('Beto Gómez'));

  await waitFor(() => expect(queryByText('Gasolina')).toBeNull());
  expect(getByText('Almuerzo')).toBeTruthy();
});

test('"Todos" en el filtro de usuario devuelve las tres transacciones', async () => {
  const { findByText, findAllByText, getByText } = render(
    <FinancialPanelPRO dateFrom={new Date()} dateTo={new Date()} />
  );

  fireEvent.press(await findByText('Transacciones financieras (3)'));
  fireEvent.press(getByText('Ana Pérez'));
  await waitFor(() => expect(getByText('Gasolina')).toBeTruthy());

  // "Todos" existe en el chip de método de pago y en el de usuario — el de
  // usuario es el último renderizado.
  const todosNodes = await findAllByText('Todos');
  fireEvent.press(todosNodes[todosNodes.length - 1]);

  await waitFor(() => {
    expect(getByText('Gasolina')).toBeTruthy();
    expect(getByText('Almuerzo')).toBeTruthy();
    expect(getByText('Peaje autopista')).toBeTruthy();
  });
});

test('usuario + categoría combinados: solo la transacción que cumple ambos', async () => {
  const { findByText, findAllByText, getByText, queryByText } = render(
    <FinancialPanelPRO dateFrom={new Date()} dateTo={new Date()} />
  );

  fireEvent.press(await findByText('Transacciones financieras (3)'));
  fireEvent.press(getByText('Ana Pérez'));
  await waitFor(() => expect(getByText('Gasolina')).toBeTruthy());

  const foodNodes = await findAllByText('Alimentación');
  fireEvent.press(foodNodes[foodNodes.length - 1]);

  await waitFor(() => expect(queryByText('Gasolina')).toBeNull());
  expect(queryByText('Almuerzo')).toBeNull(); // es de Beto, no de Ana
});

test('un financial histórico sin createdByUid no coincide con ningún filtro de usuario, pero sigue en el total general', async () => {
  const { findByText, getByText, queryByText, findAllByText } = render(
    <FinancialPanelPRO dateFrom={new Date()} dateTo={new Date()} />
  );

  // Aparece sin filtro
  fireEvent.press(await findByText('Transacciones financieras (3)'));
  expect(await findByText('Peaje autopista')).toBeTruthy();
  // El total general (KPI) sigue incluyéndolo
  expect((await findAllByText('C$900.00')).length).toBeGreaterThan(0);

  // Al filtrar por un usuario específico, desaparece (no tiene createdByUid)
  fireEvent.press(getByText('Ana Pérez'));
  await waitFor(() => expect(queryByText('Peaje autopista')).toBeNull());
});

test('sin gastos aprobados en el período, no se muestra la tarjeta de desglose', async () => {
  mockGetFinancialDetail.mockResolvedValue({
    ...baseResult,
    financialDocs: [],
    extExpenses: 0,
    expenseBreakdown: { total: 0, count: 0, byCategory: {}, byPaymentMethod: {} },
  });

  const { queryByText, findByText } = render(<FinancialPanelPRO dateFrom={new Date()} dateTo={new Date()} />);

  await findByText('Resumen Financiero');
  expect(queryByText(/Gastos operativos/)).toBeNull();
});
