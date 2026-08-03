import {
  computeAbono,
  getDaysOverdue,
  getEffectiveCreditLimit,
  getCreditBehavior,
  toDateSafe,
} from '../creditUtils';

describe('computeAbono', () => {
  const credit = { total: 500, paid: 100, pending: 400, status: 'pending' };

  it('aplica un abono parcial', () => {
    const res = computeAbono(credit, 150);
    expect(res).toMatchObject({
      applied: 150, received: 150, change: 0,
      previousPending: 400, newPending: 250, newPaid: 250,
      status: 'pending',
    });
  });

  it('salda el crédito con el monto exacto', () => {
    const res = computeAbono(credit, 400);
    expect(res).toMatchObject({ applied: 400, change: 0, newPending: 0, newPaid: 500, status: 'paid' });
  });

  it('acepta sobrepago: aplica solo el pendiente y devuelve el cambio', () => {
    const res = computeAbono(credit, 450);
    expect(res).toMatchObject({
      applied: 400, received: 450, change: 50,
      newPending: 0, newPaid: 500, status: 'paid',
    });
  });

  it('deriva el pendiente de total-paid aunque pending almacenado esté desactualizado', () => {
    const res = computeAbono({ total: 500, paid: 450, pending: 400 }, 100);
    expect(res).toMatchObject({ applied: 50, change: 50, newPending: 0, status: 'paid' });
  });

  it('usa pending almacenado en créditos legacy sin total', () => {
    const res = computeAbono({ total: 0, paid: 0, pending: 120 }, 100);
    expect(res).toMatchObject({ applied: 100, newPending: 20, newPaid: 100, status: 'pending' });
  });

  it('maneja centavos sin errores de flotante', () => {
    const res = computeAbono({ total: 10, paid: 9.9, pending: 0.1 }, 0.1);
    expect(res.newPending).toBe(0);
    expect(res.status).toBe('paid');
  });

  it('rechaza montos inválidos', () => {
    expect(() => computeAbono(credit, 0)).toThrow('Monto inválido');
    expect(() => computeAbono(credit, -5)).toThrow('Monto inválido');
    expect(() => computeAbono(credit, 'abc')).toThrow('Monto inválido');
  });

  it('rechaza abonos a créditos ya saldados', () => {
    expect(() => computeAbono({ total: 100, paid: 100, pending: 0 }, 10))
      .toThrow('Este crédito ya está saldado.');
  });
});

describe('getDaysOverdue', () => {
  const now = new Date(2026, 6, 17); // 17 jul 2026

  it('devuelve 0 sin fecha de pago', () => {
    expect(getDaysOverdue({ status: 'pending' }, now)).toBe(0);
  });

  it('devuelve 0 si aún no vence', () => {
    expect(getDaysOverdue({ status: 'pending', dueDate: new Date(2026, 6, 20) }, now)).toBe(0);
  });

  it('devuelve 0 el mismo día del vencimiento', () => {
    expect(getDaysOverdue({ status: 'pending', dueDate: new Date(2026, 6, 17, 8, 0) }, now)).toBe(0);
  });

  it('cuenta los días de atraso', () => {
    expect(getDaysOverdue({ status: 'pending', dueDate: new Date(2026, 6, 10) }, now)).toBe(7);
  });

  it('devuelve 0 para créditos pagados aunque la fecha haya pasado', () => {
    expect(getDaysOverdue({ status: 'paid', dueDate: new Date(2026, 5, 1) }, now)).toBe(0);
  });

  it('acepta Timestamps de Firestore ({seconds})', () => {
    const due = { seconds: new Date(2026, 6, 12).getTime() / 1000 };
    expect(getDaysOverdue({ status: 'pending', dueDate: due }, now)).toBe(5);
  });
});

describe('getEffectiveCreditLimit', () => {
  it('sin sobregiro devuelve el límite base', () => {
    expect(getEffectiveCreditLimit({ creditLimit: 1000 }))
      .toEqual({ base: 1000, extra: 0, total: 1000 });
  });

  it('sobregiro porcentual', () => {
    expect(getEffectiveCreditLimit({ creditLimit: 1000, creditOverdraftType: 'percent', creditOverdraftValue: 20 }))
      .toEqual({ base: 1000, extra: 200, total: 1200 });
  });

  it('sobregiro de monto fijo', () => {
    expect(getEffectiveCreditLimit({ creditLimit: 1000, creditOverdraftType: 'fixed', creditOverdraftValue: 350 }))
      .toEqual({ base: 1000, extra: 350, total: 1350 });
  });

  it('ignora sobregiro con valor 0, tipo desconocido o cliente nulo', () => {
    expect(getEffectiveCreditLimit({ creditLimit: 500, creditOverdraftType: 'percent', creditOverdraftValue: 0 }).total).toBe(500);
    expect(getEffectiveCreditLimit({ creditLimit: 500, creditOverdraftType: 'otro', creditOverdraftValue: 10 }).total).toBe(500);
    expect(getEffectiveCreditLimit(null)).toEqual({ base: 0, extra: 0, total: 0 });
  });
});

describe('getCreditBehavior', () => {
  const now = new Date(2026, 6, 17);

  it('resume saldo vigente, puntualidad y atrasos', () => {
    const credits = [
      // Pagado a tiempo (último abono antes de la fecha)
      { status: 'paid', dueDate: new Date(2026, 5, 10), payments: [{ date: new Date(2026, 5, 8) }] },
      // Pagado tarde
      { status: 'paid', dueDate: new Date(2026, 5, 10), payments: [{ date: new Date(2026, 5, 20) }] },
      // Pagado sin fecha acordada → cuenta a tiempo
      { status: 'paid', payments: [{ date: new Date(2026, 5, 20) }] },
      // Pendiente vencido
      { status: 'pending', pending: 300, dueDate: new Date(2026, 6, 1) },
      // Pendiente al día
      { status: 'pending', pending: 200, dueDate: new Date(2026, 6, 30) },
    ];

    expect(getCreditBehavior(credits, now)).toEqual({
      pendingAmount: 500,
      pendingCount: 2,
      paidOnTime: 2,
      paidLate: 1,
      overdueCount: 1,
      onTimeRate: 67,
    });
  });

  it('sin historial pagado la puntualidad es null', () => {
    expect(getCreditBehavior([], now).onTimeRate).toBeNull();
    expect(getCreditBehavior([{ status: 'pending', pending: 10 }], now).onTimeRate).toBeNull();
  });
});

describe('toDateSafe', () => {
  it('convierte Date, {seconds}, string y rechaza inválidos', () => {
    const d = new Date(2026, 0, 15);
    expect(toDateSafe(d)).toEqual(d);
    expect(toDateSafe({ seconds: d.getTime() / 1000 })).toEqual(d);
    expect(toDateSafe({ toDate: () => d })).toEqual(d);
    expect(toDateSafe(null)).toBeNull();
    expect(toDateSafe('no-es-fecha')).toBeNull();
  });
});
