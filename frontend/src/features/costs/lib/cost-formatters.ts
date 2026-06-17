const currencyFormatterCache = new Map<string, Intl.NumberFormat>();

const dateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function getCurrencyFormatter(currency: string) {
  const normalizedCurrency = currency.trim().toUpperCase() || 'USD';
  const cachedFormatter = currencyFormatterCache.get(normalizedCurrency);

  if (cachedFormatter) {
    return cachedFormatter;
  }

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: normalizedCurrency,
    maximumFractionDigits: 2,
  });

  currencyFormatterCache.set(normalizedCurrency, formatter);

  return formatter;
}

export function formatCostCurrency(value: number, currency = 'USD'): string {
  try {
    return getCurrencyFormatter(currency).format(value);
  } catch {
    return `${currency.toUpperCase()} ${value.toFixed(2)}`;
  }
}

export function formatCostDateTime(value: string): string {
  return dateTimeFormatter.format(new Date(value));
}
