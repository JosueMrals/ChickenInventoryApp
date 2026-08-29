// Lógica pura del módulo de créditos: cálculo de abonos, atrasos y límite
// efectivo (límite + sobregiro). Sin dependencias de Firebase para poder
// testearla con jest sin mocks.

const toCents = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num * 100);
};

const fromCents = (value) => Number((value / 100).toFixed(2));

/** Convierte Timestamp de Firestore, Date, string o {seconds} a Date (o null). */
export const toDateSafe = (value) => {
  if (!value) return null;
  if (typeof value.toDate === 'function') return value.toDate();
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value.seconds === 'number') return new Date(value.seconds * 1000);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

/**
 * Días de atraso de un crédito respecto a su fecha de pago acordada.
 * Devuelve 0 si no hay fecha, si aún no vence o si el crédito ya está pagado.
 */
export const getDaysOverdue = (credit, now = new Date()) => {
  if (!credit || credit.status === 'paid') return 0;
  const due = toDateSafe(credit.dueDate);
  if (!due) return 0;

  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffMs = startOfDay(now) - startOfDay(due);
  const days = Math.floor(diffMs / 86400000);
  return days > 0 ? days : 0;
};

/**
 * Límite efectivo de crédito del cliente: límite base + sobregiro.
 * El sobregiro se configura en el cliente como porcentaje del límite
 * (creditOverdraftType: 'percent') o monto fijo ('fixed').
 */
export const getEffectiveCreditLimit = (customer) => {
  const base = Number(customer?.creditLimit) || 0;
  const value = Number(customer?.creditOverdraftValue) || 0;
  const type = customer?.creditOverdraftType;

  let extra = 0;
  if (value > 0) {
    if (type === 'percent') extra = fromCents(toCents((base * value) / 100));
    else if (type === 'fixed') extra = fromCents(toCents(value));
  }

  return { base, extra, total: fromCents(toCents(base) + toCents(extra)) };
};

/**
 * Disponibilidad de crédito de un cliente CONSIDERANDO lo que ya debe.
 *
 * Antes solo se comparaba el total de la venta contra el límite: un cliente con
 * límite C$1,000 que ya debía C$950 podía llevarse otra venta de C$1,000, y
 * otra. El tope se aplica ahora sobre la exposición total (deuda vigente + esta
 * venta).
 *
 * `outstanding` es la suma de lo pendiente en los créditos vigentes del cliente.
 * Pasar `null` significa "no se pudo verificar" (sin señal): en ese caso se
 * valida solo contra el total de la venta —el comportamiento anterior— y
 * `verified` sale en false para que la UI lo advierta.
 */
export const computeCreditExposure = ({ customer, outstanding = null, saleTotal = 0 } = {}) => {
  const limit = getEffectiveCreditLimit(customer);
  const limitCents = toCents(limit.total);
  const saleCents = Math.max(0, toCents(saleTotal));

  // OJO: Number(null) es 0, que es finito. Sin descartar null/undefined aparte,
  // un saldo NO verificado se leería como "verificado, no debe nada" — que es
  // justo el caso peligroso: autorizaría crédito a un cliente sobregirado.
  const verified = outstanding !== null
    && outstanding !== undefined
    && Number.isFinite(Number(outstanding));
  const outstandingCents = verified ? Math.max(0, toCents(outstanding)) : 0;
  const usedCents = outstandingCents + saleCents;
  const enabled = limitCents > 0;

  return {
    enabled,
    verified,
    limit: limit.total,
    extra: limit.extra,
    outstanding: verified ? fromCents(outstandingCents) : null,
    // Lo que le queda al cliente DESPUÉS de esta venta.
    available: fromCents(Math.max(0, limitCents - usedCents)),
    exceeded: enabled && usedCents > limitCents,
  };
};

/**
 * Calcula el resultado de un abono. Acepta pagos mayores al saldo: aplica solo
 * el pendiente y reporta el cambio a devolver.
 * Lanza Error con mensaje en español si el monto es inválido o no hay saldo.
 */
export const computeAbono = (credit, amount) => {
  const pagoCents = toCents(amount);
  if (!pagoCents || pagoCents <= 0) throw new Error('Monto inválido');

  const totalCents = toCents(credit?.total || 0);
  const paidCents = toCents(credit?.paid || 0);
  const pendingStoredCents = toCents(credit?.pending || 0);
  const pendingCents = totalCents > 0
    ? Math.max(0, totalCents - paidCents)
    : pendingStoredCents;

  if (pendingCents <= 0) throw new Error('Este crédito ya está saldado.');

  const appliedCents = Math.min(pagoCents, pendingCents);
  const changeCents = pagoCents - appliedCents;
  const newPendingCents = pendingCents - appliedCents;
  const newPaidCents = totalCents > 0 && newPendingCents === 0
    ? totalCents
    : paidCents + appliedCents;

  return {
    applied: fromCents(appliedCents),
    received: fromCents(pagoCents),
    change: fromCents(changeCents),
    previousPending: fromCents(pendingCents),
    newPending: fromCents(newPendingCents),
    newPaid: fromCents(newPaidCents),
    status: newPendingCents === 0 ? 'paid' : 'pending',
  };
};

/**
 * Indicadores de comportamiento crediticio de un cliente a partir de sus
 * créditos: saldo vigente, pagados a tiempo/atrasados y puntualidad.
 * Un crédito pagado cuenta "a tiempo" si su último abono fue en o antes de la
 * fecha acordada (o si no tenía fecha acordada).
 */
export const getCreditBehavior = (credits = [], now = new Date()) => {
  let pendingAmount = 0;
  let pendingCount = 0;
  let paidOnTime = 0;
  let paidLate = 0;
  let overdueCount = 0;

  credits.forEach((credit) => {
    if (!credit) return;
    if (credit.status === 'paid') {
      const due = toDateSafe(credit.dueDate);
      const payments = Array.isArray(credit.payments) ? credit.payments : [];
      const lastPayment = payments.length ? toDateSafe(payments[payments.length - 1]?.date) : null;
      if (due && lastPayment && lastPayment > new Date(due.getFullYear(), due.getMonth(), due.getDate(), 23, 59, 59)) {
        paidLate += 1;
      } else {
        paidOnTime += 1;
      }
      return;
    }

    pendingCount += 1;
    pendingAmount += Number(credit.pending) || 0;
    if (getDaysOverdue(credit, now) > 0) overdueCount += 1;
  });

  const paidTotal = paidOnTime + paidLate;
  return {
    pendingAmount: fromCents(toCents(pendingAmount)),
    pendingCount,
    paidOnTime,
    paidLate,
    overdueCount,
    // null cuando no hay historial pagado: sin datos no hay puntualidad que mostrar.
    onTimeRate: paidTotal > 0 ? Math.round((paidOnTime / paidTotal) * 100) : null,
  };
};
