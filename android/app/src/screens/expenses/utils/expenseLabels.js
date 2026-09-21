// Etiquetas humanas y mensajes operacionales para Gastos Operativos. Separado
// de expenseService.js (dominio) — esto es puramente presentación, sin
// escribir ni calcular nada del negocio (Single Responsibility).

export const CATEGORY_LABELS = {
  FUEL: 'Combustible',
  VIATICOS: 'Viáticos',
  FOOD: 'Alimentación',
  MAINTENANCE: 'Mantenimiento',
  TOLL: 'Peaje',
  PARKING: 'Parqueo',
  OTHER: 'Otro',
};

export const PAYMENT_METHOD_LABELS = {
  CASH: 'Efectivo',
  TRANSFER: 'Transferencia',
  CARD: 'Tarjeta',
  PERSONAL: 'Dinero personal',
};

export const STATUS_LABELS = {
  PENDING: 'Pendiente de revisión',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  CANCELLED: 'Cancelado',
};

// Estados del reembolso (`reimbursements/{expenseId}`, FASE E6.1) — dominio
// separado del estado del Expense (ver STATUS_LABELS arriba).
export const REIMBURSEMENT_STATUS_LABELS = {
  PENDING: 'Reembolso pendiente',
  PAID: 'Reembolso pagado',
  CANCELLED: 'Reembolso cancelado',
};

// Mensaje del formulario: qué va a pasar con este gasto según el método de
// pago. Es información operacional para el usuario, no la fórmula del cierre
// (esa sigue viviendo exclusivamente en expenseService/cashClosingService).
export function getPaymentMethodImpactMessage(paymentMethod) {
  switch (paymentMethod) {
    case 'CASH':
      return 'Este gasto se descontará del efectivo que debes entregar.';
    case 'PERSONAL':
      return 'Pagaste con tu dinero. Se registrará un reembolso pendiente.';
    case 'TRANSFER':
    case 'CARD':
      return 'No afecta el efectivo físico, pero quedará registrado.';
    default:
      return '';
  }
}

// Etiqueta corta para listas/detalle. PENDING no cambia este resultado — un
// CASH pendiente ya "impacta efectivo" (ver FASE E1.1, Modelo A): la revisión
// del admin es aparte y no altera este indicador.
export function getCashImpactBadge(paymentMethod) {
  if (paymentMethod === 'CASH') return 'Impacta efectivo';
  if (paymentMethod === 'PERSONAL') return 'Reembolso pendiente';
  return 'No afecta efectivo';
}
