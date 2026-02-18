export const buildCustomerName = (customer, fallback = 'Cliente sin nombre') => {
  if (!customer) return fallback;
  const firstName = (customer.firstName || '').trim();
  const lastName = (customer.lastName || '').trim();
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();
  return fullName || fallback;
};

export const resolveCustomerName = (presale = {}, customersById = {}, fallback = 'Cliente sin nombre') => {
  const customerField = presale.customer;
  const customerId = presale.customerId || (typeof customerField === 'object' ? customerField?.id : customerField);
  const customerFromMap = customerId ? customersById?.[customerId] : null;
  const customerFromPresale = typeof customerField === 'object' ? customerField : null;

  const resolvedName = buildCustomerName(customerFromMap || customerFromPresale, '');
  if (resolvedName) return resolvedName;

  const fallbackName = (presale.customerName || '').trim();
  return fallbackName || fallback;
};

