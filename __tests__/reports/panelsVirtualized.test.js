// Los paneles de clientes y productos pasaron de ScrollView + .map() a FlatList,
// lo que obligó a subir el estado de los sub-filtros y a mover los controles al
// header. Esto verifica que la reestructuración no rompió nada observable:
// que renderizan, que las filas salen, y que cambiar de orden/filtro sigue andando.
import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';

jest.mock('../../android/app/src/screens/reports/services/reportsService', () => ({
  getClientsReport: jest.fn(),
  getProductsReport: jest.fn(),
}));

import {
  getClientsReport,
  getProductsReport,
} from '../../android/app/src/screens/reports/services/reportsService';
import ClientsPanelPRO from '../../android/app/src/screens/reports/panels/ClientsPanelPRO';
import ProductsPanelPRO from '../../android/app/src/screens/reports/panels/ProductsPanelPRO';

const cliente = (id, name, total) => ({
  id, name, total, count: 2, avgTicket: total / 2, itemsQty: 4,
  type: 'Común', isActive: true, isNew: false, lastDate: null,
  phone: '5550000', cedula: '001', creditLimit: 0,
});

const producto = (id, name, revenue) => ({
  id, name, revenue, qtySold: 10, margin: 0.3, cost: 5, salePrice: 10,
  stock: 12, stockValue: 60, isLowStock: false, isOutOfStock: false,
  category: 'Pollo',
});

describe('ClientsPanelPRO virtualizado', () => {
  const clients = [cliente('c1', 'Ana Torres', 900), cliente('c2', 'Beto Ruiz', 300)];

  beforeEach(() => {
    getClientsReport.mockResolvedValue({
      totalClients: 2, activeCount: 2, newCount: 0, totalRevenue: 1200,
      avgTicket: 600, topClients: clients, allClients: clients,
      newClients: [], byType: [], anonymousCount: 0,
    });
  });

  it('renderiza las filas del tab Top', async () => {
    const { getByText } = render(<ClientsPanelPRO dateFrom={null} dateTo={null} />);
    await waitFor(() => expect(getByText('Ana Torres')).toBeTruthy());
    expect(getByText('Beto Ruiz')).toBeTruthy();
  });

  it('cambiar el orden no rompe la lista (estado subido al panel)', async () => {
    const { getByText } = render(<ClientsPanelPRO dateFrom={null} dateTo={null} />);
    await waitFor(() => expect(getByText('Ana Torres')).toBeTruthy());

    fireEvent.press(getByText('# Compras'));
    await waitFor(() => expect(getByText('Ana Torres')).toBeTruthy());
  });

  it('cambiar de tab al Directorio sigue mostrando clientes', async () => {
    const { getByText } = render(<ClientsPanelPRO dateFrom={null} dateTo={null} />);
    await waitFor(() => expect(getByText('Ana Torres')).toBeTruthy());

    fireEvent.press(getByText('Directorio'));
    await waitFor(() => expect(getByText('Todos')).toBeTruthy());
    expect(getByText('Ana Torres')).toBeTruthy();
  });
});

describe('ProductsPanelPRO virtualizado', () => {
  const products = [producto('p1', 'Pechuga', 800), producto('p2', 'Muslo', 400)];

  beforeEach(() => {
    getProductsReport.mockResolvedValue({
      totalProducts: 2, totalRevenue: 1200, totalQtySold: 20, totalStockValue: 120,
      lowStockCount: 0, outOfStockCount: 0,
      topBySales: products, allProducts: products,
      lowStock: [], outOfStock: [], categories: [],
    });
  });

  it('renderiza las filas del tab Ventas', async () => {
    const { getByText } = render(<ProductsPanelPRO dateFrom={null} dateTo={null} />);
    await waitFor(() => expect(getByText('Pechuga')).toBeTruthy());
    expect(getByText('Muslo')).toBeTruthy();
  });

  // "Margen" y no "Ingresos": este último aparece también como etiqueta de KPI.
  it('cambiar el orden a Margen mantiene las filas', async () => {
    const { getByText } = render(<ProductsPanelPRO dateFrom={null} dateTo={null} />);
    await waitFor(() => expect(getByText('Pechuga')).toBeTruthy());

    fireEvent.press(getByText('Margen'));
    await waitFor(() => expect(getByText('Pechuga')).toBeTruthy());
  });

  it('cambiar al tab Inventario muestra los mini-KPIs de stock y las filas', async () => {
    const { getByText } = render(<ProductsPanelPRO dateFrom={null} dateTo={null} />);
    await waitFor(() => expect(getByText('Pechuga')).toBeTruthy());

    fireEvent.press(getByText('Inventario'));
    await waitFor(() => expect(getByText('Stock bajo')).toBeTruthy());
    expect(getByText('Pechuga')).toBeTruthy();
  });
});
