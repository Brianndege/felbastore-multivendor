const DEFAULT_LOCALE = "en-KE";
const DEFAULT_CURRENCY = "KES";

export function normalizeCurrencyCode(currency: string | null | undefined): string {
  const candidate = String(currency || "").trim().toUpperCase();
  return /^[A-Z]{3}$/.test(candidate) ? candidate : DEFAULT_CURRENCY;
}

export function formatCurrency(
  amount: number | string,
  currency: string | null | undefined,
  locale: string = DEFAULT_LOCALE
): string {
  const normalizedCurrency = normalizeCurrencyCode(currency);
  const numericAmount = Number(amount);

  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: normalizedCurrency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(numericAmount) ? numericAmount : 0);
  } catch {
    return `${normalizedCurrency} ${(Number.isFinite(numericAmount) ? numericAmount : 0).toFixed(2)}`;
  }
}
