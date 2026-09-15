/**
 * normalizeText: usado por los buscadores de cliente (presales, quicksales,
 * customer, warehouse) para que "Josue" encuentre "Josué" sin exigir tildes.
 */

const { normalizeText } = require('../android/app/src/utils/textUtils');

test('ignora tildes al comparar', () => {
  expect(normalizeText('Josué Morales')).toBe('josue morales');
  expect(normalizeText('Peña')).toBe('pena');
});

test('un término sin tilde encuentra un nombre con tilde', () => {
  const haystack = normalizeText('Josué Morales');
  expect(haystack.includes(normalizeText('Josue'))).toBe(true);
  expect(haystack.includes(normalizeText('josué'))).toBe(true);
});

test('null/undefined no rompen la normalización', () => {
  expect(normalizeText(null)).toBe('');
  expect(normalizeText(undefined)).toBe('');
});
