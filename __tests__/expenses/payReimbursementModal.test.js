/**
 * PayReimbursementModal — selección de método/referencia/notas antes de
 * confirmar el pago de un reembolso (FASE E6.2). No valida el pago en sí
 * (eso ya lo prueba reimbursementServiceTransaction.test.js) — solo que la
 * UI arma el payload correcto y respeta validatePaymentData().
 *
 * react-test-renderer no soporta el <Modal> nativo completo (require de todo
 * `react-native` dispara TurboModuleRegistry) — se intercepta solo el archivo
 * interno de Modal, sin tocar el resto del preset de RN ya usado en el repo.
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('react-native/Libraries/Modal/Modal', () => {
  const ReactActual = require('react');
  const { View } = jest.requireActual('react-native');
  const MockModal = ({ visible, children }) => (visible ? ReactActual.createElement(View, null, children) : null);
  return { __esModule: true, default: MockModal };
});

import PayReimbursementModal from '../../android/app/src/screens/expenses/components/PayReimbursementModal';

const reimbursement = { id: 'e1', amount: 500 };
const onClose = jest.fn();
const onSubmit = jest.fn();

beforeEach(() => {
  onClose.mockClear();
  onSubmit.mockClear();
});

test('reimbursement null: no renderiza nada', () => {
  const { toJSON } = render(
    <PayReimbursementModal visible reimbursement={null} onClose={onClose} onSubmit={onSubmit} />
  );
  expect(toJSON()).toBeNull();
});

test('por defecto selecciona Efectivo y no pide referencia', async () => {
  const { findByText, queryByPlaceholderText } = render(
    <PayReimbursementModal visible reimbursement={reimbursement} onClose={onClose} onSubmit={onSubmit} />
  );
  expect(await findByText(/C\$500\.00/)).toBeTruthy();
  expect(queryByPlaceholderText('N.º de comprobante o referencia')).toBeNull();

  fireEvent.press(await findByText('Continuar'));
  expect(onSubmit).toHaveBeenCalledWith({ paymentMethod: 'CASH', reference: null, notes: null });
});

test('al elegir Transferencia aparece el campo de referencia', async () => {
  const { findByText, findByPlaceholderText } = render(
    <PayReimbursementModal visible reimbursement={reimbursement} onClose={onClose} onSubmit={onSubmit} />
  );
  fireEvent.press(await findByText('Transferencia'));
  expect(await findByPlaceholderText('N.º de comprobante o referencia')).toBeTruthy();
});

test('Transferencia sin referencia: bloquea el submit y muestra el error', async () => {
  const { findByText } = render(
    <PayReimbursementModal visible reimbursement={reimbursement} onClose={onClose} onSubmit={onSubmit} />
  );
  fireEvent.press(await findByText('Transferencia'));
  fireEvent.press(await findByText('Continuar'));

  expect(onSubmit).not.toHaveBeenCalled();
  expect(await findByText('La referencia de la transferencia es obligatoria.')).toBeTruthy();
});

test('Transferencia con referencia: arma el payload correcto, recorta espacios', async () => {
  const { findByText, findByPlaceholderText } = render(
    <PayReimbursementModal visible reimbursement={reimbursement} onClose={onClose} onSubmit={onSubmit} />
  );
  fireEvent.press(await findByText('Transferencia'));
  fireEvent.changeText(await findByPlaceholderText('N.º de comprobante o referencia'), '  TRX-001  ');
  fireEvent.press(await findByText('Continuar'));

  expect(onSubmit).toHaveBeenCalledWith({ paymentMethod: 'TRANSFER', reference: 'TRX-001', notes: null });
});

test('Cancelar llama a onClose sin llamar a onSubmit', async () => {
  const { findByText } = render(
    <PayReimbursementModal visible reimbursement={reimbursement} onClose={onClose} onSubmit={onSubmit} />
  );
  fireEvent.press(await findByText('Cancelar'));
  expect(onClose).toHaveBeenCalled();
  expect(onSubmit).not.toHaveBeenCalled();
});
