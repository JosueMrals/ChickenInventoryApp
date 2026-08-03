/**
 * Ticket de entrega abierto desde Reportes → Ventas.
 *
 * Regresión: el ticket se renderizaba como una vista de altura libre dentro de
 * un modal acotado, SIN scroll. Con pocos productos se veía completo, pero en
 * una venta con varias líneas el contenido se cortaba y no había forma de
 * llegar al TOTAL A PAGAR ni al pie — justo los datos que se consultan.
 */
import React from 'react';
import { ScrollView } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';

jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');

// El contexto del ticket (usuarios + logo) se resuelve contra Firestore y
// AsyncStorage; aquí solo importa que el ticket reciba el mapa de nombres.
jest.mock('../../android/app/src/screens/reports/hooks/useReceiptContext', () => ({
  useReceiptContext: () => ({
    usersById: { 'ana@test.com': { nombre: 'Ana', apellido: 'Ruiz' } },
    ticketSettings: null,
  }),
}));

import SaleReceiptModal from '../../android/app/src/screens/reports/components/SaleReceiptModal';

const ventaCon = (n) => ({
  __kind: 'presale',
  preSaleNumber: '000123',
  customerName: 'Pulpería La Esquina',
  total: n * 100,
  createdAt: { toDate: () => new Date(2026, 6, 10, 9, 0) },
  createdBy: 'ana@test.com',
  items: Array.from({ length: n }, (_, i) => ({
    productName: `Producto ${i + 1}`,
    quantity: 2,
    unitPrice: 50,
    total: 100,
  })),
  bonuses: [],
});

describe('SaleReceiptModal', () => {
  it('renderiza el ticket dentro de un ScrollView para que no se corte', () => {
    const { UNSAFE_getAllByType } = render(
      <SaleReceiptModal sale={ventaCon(30)} visible onClose={() => {}} />,
    );

    expect(UNSAFE_getAllByType(ScrollView).length).toBeGreaterThan(0);
  });

  it('el TOTAL sigue presente en un ticket largo', () => {
    const { getByText } = render(
      <SaleReceiptModal sale={ventaCon(30)} visible onClose={() => {}} />,
    );

    expect(getByText('TOTAL A PAGAR:')).toBeTruthy();
    expect(getByText('C$3000.00')).toBeTruthy();
    // La última línea también se renderiza (el corte anterior se las comía).
    expect(getByText('PRODUCTO 30')).toBeTruthy();
  });

  it('la cabecera identifica el documento sin tener que desplazarse', () => {
    const { getByText } = render(
      <SaleReceiptModal sale={ventaCon(2)} visible onClose={() => {}} />,
    );

    expect(getByText('Ticket de entrega')).toBeTruthy();
    expect(getByText('Pre-venta · #000123')).toBeTruthy();
  });

  it('muestra el NOMBRE del vendedor, no su correo', async () => {
    const { getByText, queryByText } = render(
      <SaleReceiptModal sale={ventaCon(1)} visible onClose={() => {}} />,
    );

    await waitFor(() => expect(getByText('ANA RUIZ')).toBeTruthy());
    expect(queryByText('ANA@TEST.COM')).toBeNull();
  });

  it('sin venta seleccionada no renderiza nada', () => {
    const { toJSON } = render(<SaleReceiptModal sale={null} visible onClose={() => {}} />);
    expect(toJSON()).toBeNull();
  });
});
