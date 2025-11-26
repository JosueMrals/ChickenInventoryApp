// utils/dateRanges.js

/** Convierte un Date JS a Timestamp Firestore si lo necesitas */
export const toStartOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const toEndOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

/**
 * Obtiene el inicio y fin de la semana ISO (lunes a domingo)
 */
export const getWeekRange = (date = new Date()) => {
  const d = new Date(date);
  const day = d.getDay(); // 0=Domingo, 1=Lunes...
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { from: monday, to: sunday };
};

/**
 * Obtiene el inicio y fin del mes actual
 */
export const getMonthRange = (date = new Date()) => {
  const d = new Date(date);

  const first = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

  return { from: first, to: last };
};

/**
 * Obtiene el inicio y fin del año actual
 */
export const getYearRange = (date = new Date()) => {
  const d = new Date(date);

  const first = new Date(d.getFullYear(), 0, 1, 0, 0, 0, 0);
  const last = new Date(d.getFullYear(), 11, 31, 23, 59, 59, 999);

  return { from: first, to: last };
};

/**
 * Rangos rápidos usados por los filtros de pill:
 * hoy, ayer, semana, mes, año
 */
export const getQuickRange = (key) => {
  const today = new Date();

  switch (key) {
    case "today": {
      return {
        from: toStartOfDay(today),
        to: toEndOfDay(today)
      };
    }

    case "yesterday": {
      const y = new Date();
      y.setDate(today.getDate() - 1);
      return {
        from: toStartOfDay(y),
        to: toEndOfDay(y)
      };
    }

    case "week": {
      return getWeekRange(today);
    }

    case "month": {
      return getMonthRange(today);
    }

    case "year": {
      return getYearRange(today);
    }

    default:
      return { from: null, to: null };
  }
};

/**
 * Utilidad para rango personalizado
 */
export const makeRange = (from, to) => {
  if (!from || !to) return { from: null, to: null };
  return { from: toStartOfDay(from), to: toEndOfDay(to) };
};
