function normalizeText(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function normalizeValue(value) {
  if (value === undefined) return null;
  if (value === null) return null;

  if (typeof value === 'string') return normalizeText(value);

  if (typeof value === 'number') {
    if (Number.isNaN(value)) return null;
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item));
  }

  if (typeof value === 'object') {
    const result = {};
    Object.entries(value).forEach(([key, val]) => {
      const normalized = normalizeValue(val);
      if (normalized !== undefined) result[key] = normalized;
    });
    return result;
  }

  return value;
}

function isEmptyValue(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

function toAction(fromValue, toValue) {
  if (isEmptyValue(fromValue) && !isEmptyValue(toValue)) return 'created';
  if (!isEmptyValue(fromValue) && isEmptyValue(toValue)) return 'deleted';
  return 'updated';
}

export function buildCreateChanges(payload = {}) {
  const changes = {};

  Object.entries(payload).forEach(([key, rawValue]) => {
    const normalized = normalizeValue(rawValue);
    if (isEmptyValue(normalized)) return;

    // Evita ruido de campos internos opcionales no relevantes para el detalle.
    if (key === 'autoSalePrice' && normalized === true) return;

    changes[key] = {
      from: null,
      to: normalized,
      action: 'created',
    };
  });

  return changes;
}

export function buildUpdateChanges(previous = {}, next = {}) {
  // Solo se comparan campos presentes en `next` (payload de actualizacion).
  // Evita falsos "deleted" de campos que no se enviaron en la edicion.
  const trackedKeys = Object.keys(next || {});
  const changes = {};

  trackedKeys.forEach((key) => {
    const fromValue = normalizeValue(previous?.[key]);
    const toValue = normalizeValue(next?.[key]);

    if (JSON.stringify(fromValue) === JSON.stringify(toValue)) return;

    changes[key] = {
      from: fromValue,
      to: toValue,
      action: toAction(fromValue, toValue),
    };
  });

  return changes;
}
