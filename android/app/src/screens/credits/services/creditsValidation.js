import { firestore } from '../../../services/firebaseConfig';
import { CREDIT_TO_CASH_STATUS } from '../../../services/preSaleService';
import { formatCurrency } from '../../../utils/formatMoney';

/** Acepta ids sueltos o paths legacy "presales/{id}"; null si no es un id válido. */
export function sanitizeDocId(rawId) {
  if (typeof rawId !== 'string') return null;
  const trimmed = rawId.trim();
  if (!trimmed) return null;
  if (!trimmed.includes('/')) return trimmed;

  const parts = trimmed.split('/').filter(Boolean);
  if (parts.length < 2) return null;
  return parts[parts.length - 1] || null;
}

export const normalizeCustomerName = (raw, fallback = 'Cliente') => {
  const value = typeof raw === 'string' ? raw.trim() : '';
  return value || fallback;
};

export const buildCustomerNameFromPreSale = (preSale) => {
  const direct = normalizeCustomerName(preSale?.customerName, '');
  if (direct) return direct;

  const firstName = typeof preSale?.customer?.firstName === 'string' ? preSale.customer.firstName.trim() : '';
  const lastName = typeof preSale?.customer?.lastName === 'string' ? preSale.customer.lastName.trim() : '';
  const joined = [firstName, lastName].filter(Boolean).join(' ').trim();
  return joined || 'Cliente';
};

export function toFirestoreTimestamp(value) {
  if (value && typeof value.toDate === 'function') return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return firestore.Timestamp.fromDate(value);
  if (typeof value?.seconds === 'number') return firestore.Timestamp.fromDate(new Date(value.seconds * 1000));

  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return firestore.Timestamp.fromDate(parsed);
  }

  return firestore.Timestamp.fromDate(new Date());
}

/** Id vacío o mal formado no debe llegar nunca a una ref de Firestore. */
export function assertCreditIdValid(creditId) {
  const safeId = sanitizeDocId(creditId);
  if (!safeId) throw new Error('Crédito inválido: id no válido.');
  return safeId;
}

/** Estados de pre-venta desde los que sí se puede generar un crédito nuevo. */
export function assertPreSaleCreditable(status) {
  if (status === 'paid') throw new Error('Esta pre-venta ya fue pagada. No se puede crear un crédito.');
  if (status === 'cancelled') throw new Error('No se puede crear un crédito para una pre-venta cancelada.');
  if (status === 'credit_pending' || status?.startsWith('credit_')) {
    throw new Error('Esta pre-venta ya tiene un crédito asignado.');
  }
  if (!['pending', 'dispatched'].includes(status)) {
    throw new Error(`Estado inválido para crear crédito: ${status}.`);
  }
}

/** Borrar un crédito con abonos perdería el registro del dinero ya cobrado. */
export function assertCreditDeletable(paid) {
  if (paid > 0) {
    throw new Error(
      `Este crédito tiene ${formatCurrency(paid)} abonados. No se puede eliminar sin perder el registro de lo cobrado.`
    );
  }
}

/** A qué estado de contado vuelve la pre-venta al quitarle el crédito. */
export function resolvePreSaleRevertStatus(preSaleStatus) {
  const revertTo = CREDIT_TO_CASH_STATUS[preSaleStatus];
  if (!revertTo) {
    throw new Error(
      `No se puede eliminar: la pre-venta está en estado "${preSaleStatus}". Solo se puede quitar el crédito antes de que la orden salga de bodega.`
    );
  }
  return revertTo;
}
