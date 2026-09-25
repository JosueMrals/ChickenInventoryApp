/**
 * expenseService — lógica pura (validación, cash impact, transiciones de
 * estado permitidas). Sin tocar Firestore.
 */

jest.mock('@react-native-firebase/firestore', () => {
  const firestore = () => ({ collection: () => ({ doc: jest.fn() }) });
  firestore.FieldValue = { serverTimestamp: jest.fn(), increment: jest.fn() };
  return firestore;
});
jest.mock('@react-native-firebase/auth', () => () => ({ currentUser: null }));

const {
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  validateExpenseDraft,
  computeCashImpact,
  canCancelExpense,
  canReviewExpense,
} = require('../../android/app/src/screens/expenses/services/expenseService');

const validReceipt = { url: 'https://mock/receipt.jpg', path: 'expenseReceipts/u1_1.jpg' };
const validDraft = { amount: 500, category: 'FUEL', paymentMethod: 'CASH', receipt: validReceipt };

describe('validateExpenseDraft — amount', () => {
  test('acepta un monto positivo', () => {
    expect(validateExpenseDraft(validDraft)).toEqual({ ok: true });
  });

  test('rechaza amount == 0', () => {
    const r = validateExpenseDraft({ ...validDraft, amount: 0 });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/monto/i);
  });

  test('rechaza amount negativo', () => {
    expect(validateExpenseDraft({ ...validDraft, amount: -100 }).ok).toBe(false);
  });

  test('rechaza amount como string no numérico', () => {
    expect(validateExpenseDraft({ ...validDraft, amount: 'abc' }).ok).toBe(false);
  });

  test('rechaza NaN e Infinity', () => {
    expect(validateExpenseDraft({ ...validDraft, amount: NaN }).ok).toBe(false);
    expect(validateExpenseDraft({ ...validDraft, amount: Infinity }).ok).toBe(false);
  });
});

describe('validateExpenseDraft — category', () => {
  test('acepta cada categoría del catálogo cerrado', () => {
    EXPENSE_CATEGORIES.forEach((category) => {
      expect(validateExpenseDraft({ ...validDraft, category }).ok).toBe(true);
    });
  });

  test('rechaza una categoría fuera del catálogo', () => {
    const r = validateExpenseDraft({ ...validDraft, category: 'SOMETHING_ELSE' });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/categoría/i);
  });
});

describe('validateExpenseDraft — paymentMethod', () => {
  test('acepta cada método de pago soportado', () => {
    PAYMENT_METHODS.forEach((paymentMethod) => {
      expect(validateExpenseDraft({ ...validDraft, paymentMethod }).ok).toBe(true);
    });
  });

  test('rechaza un método de pago inválido', () => {
    const r = validateExpenseDraft({ ...validDraft, paymentMethod: 'BITCOIN' });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/método de pago/i);
  });
});

describe('validateExpenseDraft — comprobante', () => {
  test('rechaza sin receipt', () => {
    const r = validateExpenseDraft({ ...validDraft, receipt: undefined });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/comprobante/i);
  });

  test('rechaza receipt sin url', () => {
    const r = validateExpenseDraft({ ...validDraft, receipt: { path: 'x' } });
    expect(r.ok).toBe(false);
  });

  test('rechaza receipt sin path', () => {
    const r = validateExpenseDraft({ ...validDraft, receipt: { url: 'x' } });
    expect(r.ok).toBe(false);
  });

  test('acepta un receipt con url y path', () => {
    expect(validateExpenseDraft(validDraft).ok).toBe(true);
  });
});

describe('computeCashImpact', () => {
  test('CASH afecta caja por el monto completo', () => {
    expect(computeCashImpact({ amount: 1000, paymentMethod: 'CASH' })).toEqual({
      affectsCash: true, cashAmount: 1000, reimbursementAmount: 0,
    });
  });

  test('TRANSFER no afecta caja ni genera reembolso', () => {
    expect(computeCashImpact({ amount: 1000, paymentMethod: 'TRANSFER' })).toEqual({
      affectsCash: false, cashAmount: 0, reimbursementAmount: 0,
    });
  });

  test('CARD no afecta caja ni genera reembolso', () => {
    expect(computeCashImpact({ amount: 1000, paymentMethod: 'CARD' })).toEqual({
      affectsCash: false, cashAmount: 0, reimbursementAmount: 0,
    });
  });

  test('PERSONAL no afecta caja pero genera reembolso por el monto completo', () => {
    expect(computeCashImpact({ amount: 500, paymentMethod: 'PERSONAL' })).toEqual({
      affectsCash: false, cashAmount: 0, reimbursementAmount: 500,
    });
  });
});

describe('canCancelExpense', () => {
  const base = { createdByUid: 'u1', status: 'PENDING', cashClosingId: null };

  test('el creador puede cancelar un PENDING sin cierre asignado', () => {
    expect(canCancelExpense(base, 'u1')).toBe(true);
  });

  test('otro usuario no puede cancelarlo', () => {
    expect(canCancelExpense(base, 'u2')).toBe(false);
  });

  test('no se puede cancelar si ya no está PENDING', () => {
    expect(canCancelExpense({ ...base, status: 'APPROVED' }, 'u1')).toBe(false);
  });

  test('no se puede cancelar si ya tiene cashClosingId asignado', () => {
    expect(canCancelExpense({ ...base, cashClosingId: 'c1' }, 'u1')).toBe(false);
  });
});

// FASE E6.3.1: canReviewExpense(expense, nextStatus) — PENDING admite ambas
// decisiones; APPROVED solo admite REJECTED (rechazo posterior a la
// aprobación); REJECTED/CANCELLED son terminales.
describe('canReviewExpense', () => {
  test('PENDING → APPROVED: permitido', () => {
    expect(canReviewExpense({ status: 'PENDING' }, 'APPROVED')).toBe(true);
  });

  test('PENDING → REJECTED: permitido', () => {
    expect(canReviewExpense({ status: 'PENDING' }, 'REJECTED')).toBe(true);
  });

  test('APPROVED → REJECTED: permitido (rechazo posterior, FASE E6.3.1)', () => {
    expect(canReviewExpense({ status: 'APPROVED' }, 'REJECTED')).toBe(true);
  });

  test('APPROVED → APPROVED: no permitido (no se vuelve a aprobar)', () => {
    expect(canReviewExpense({ status: 'APPROVED' }, 'APPROVED')).toBe(false);
  });

  test('REJECTED → APPROVED: no permitido (terminal)', () => {
    expect(canReviewExpense({ status: 'REJECTED' }, 'APPROVED')).toBe(false);
  });

  test('REJECTED → REJECTED: no permitido (terminal)', () => {
    expect(canReviewExpense({ status: 'REJECTED' }, 'REJECTED')).toBe(false);
  });

  test('CANCELLED: no puede revisarse en ningún sentido', () => {
    expect(canReviewExpense({ status: 'CANCELLED' }, 'APPROVED')).toBe(false);
    expect(canReviewExpense({ status: 'CANCELLED' }, 'REJECTED')).toBe(false);
  });

  test('nextStatus inválido: siempre false, sin importar el estado', () => {
    expect(canReviewExpense({ status: 'PENDING' }, 'CANCELLED')).toBe(false);
    expect(canReviewExpense({ status: 'PENDING' }, undefined)).toBe(false);
  });
});
