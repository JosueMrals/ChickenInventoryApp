export const formatCurrency = (n) =>
  `C$${Number(n || 0).toLocaleString('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const formatNumber = (n) => Number(n || 0).toLocaleString('es-NI');
