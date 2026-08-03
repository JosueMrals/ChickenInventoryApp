// planClaimUpdates decide a quién se le reescribe el rol en producción, y la
// salida del dry-run —la única red de seguridad antes de --apply— solo vale si
// esta función es correcta.
const { planClaimUpdates } = require('../../functions/backfill_role_claims');

const claims = (entries) => new Map(entries);

describe('planClaimUpdates', () => {
  it('marca para actualizar a quien no tiene claim', () => {
    const plan = planClaimUpdates(
      [{ uid: 'u1', role: 'admin' }],
      claims([['u1', {}]]),
      new Set()
    );
    expect(plan.toUpdate).toEqual([{ uid: 'u1', role: 'admin', from: null }]);
    expect(plan.alreadyOk).toHaveLength(0);
  });

  it('es idempotente: no reescribe a quien ya tiene el claim correcto', () => {
    const plan = planClaimUpdates(
      [{ uid: 'u1', role: 'vendedor' }],
      claims([['u1', { role: 'vendedor' }]]),
      new Set()
    );
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.alreadyOk).toEqual([{ uid: 'u1', role: 'vendedor' }]);
  });

  it('corrige un claim desactualizado y reporta de dónde viene', () => {
    const plan = planClaimUpdates(
      [{ uid: 'u1', role: 'admin' }],
      claims([['u1', { role: 'vendedor' }]]),
      new Set()
    );
    expect(plan.toUpdate).toEqual([{ uid: 'u1', role: 'admin', from: 'vendedor' }]);
  });

  it('omite documentos sin cuenta de Auth', () => {
    const plan = planClaimUpdates(
      [{ uid: 'fantasma', role: 'admin' }],
      claims([]),
      new Set(['fantasma'])
    );
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.skipped[0]).toMatchObject({ uid: 'fantasma' });
  });

  // Lo importante: un rol basura NO debe convertirse en un claim.
  it.each([['user'], ['ADMIN'], [''], [null], [undefined], [123]])(
    'omite el rol inválido %p en vez de escribirlo',
    (role) => {
      const plan = planClaimUpdates(
        [{ uid: 'u1', role }],
        claims([['u1', {}]]),
        new Set()
      );
      expect(plan.toUpdate).toHaveLength(0);
      expect(plan.skipped).toHaveLength(1);
    }
  );

  it('un rol inválido no borra el claim válido que ya tenía', () => {
    const plan = planClaimUpdates(
      [{ uid: 'u1', role: 'basura' }],
      claims([['u1', { role: 'admin' }]]),
      new Set()
    );
    expect(plan.toUpdate).toHaveLength(0);
    expect(plan.skipped).toHaveLength(1);
  });

  it('clasifica un lote mixto sin perder usuarios', () => {
    const docs = [
      { uid: 'a', role: 'admin' },      // sin claim → actualizar
      { uid: 'b', role: 'vendedor' },   // ya correcto
      { uid: 'c', role: 'invalido' },   // omitido
      { uid: 'd', role: 'bodeguero' },  // sin cuenta Auth → omitido
      { uid: 'e', role: 'entregador' }, // claim viejo → actualizar
    ];
    const plan = planClaimUpdates(
      docs,
      claims([
        ['a', {}],
        ['b', { role: 'vendedor' }],
        ['c', {}],
        ['e', { role: 'vendedor' }],
      ]),
      new Set(['d'])
    );

    expect(plan.toUpdate.map((u) => u.uid)).toEqual(['a', 'e']);
    expect(plan.alreadyOk.map((u) => u.uid)).toEqual(['b']);
    expect(plan.skipped.map((u) => u.uid)).toEqual(['c', 'd']);
    // Ningún usuario se pierde entre las tres categorías.
    expect(
      plan.toUpdate.length + plan.alreadyOk.length + plan.skipped.length
    ).toBe(docs.length);
  });
});
