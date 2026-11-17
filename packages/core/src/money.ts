import { AppError } from "./errors";

export interface MoneyLine {
  unitPriceMinor: number;
  quantity: number;
  currency: string;
}

const assertInt = (n: number, label: string) => {
  if (!Number.isSafeInteger(n)) throw new AppError("VALIDATION_FAILED", `${label} must be a safe integer`);
};

/** Sum order lines in integer minor units. All lines must share one currency. */
export function sumLines(lines: MoneyLine[]): { totalMinor: number; currency: string | null } {
  let currency: string | null = null;
  let total = 0;
  for (const l of lines) {
    assertInt(l.unitPriceMinor, "unitPriceMinor");
    assertInt(l.quantity, "quantity");
    if (l.unitPriceMinor < 0 || l.quantity <= 0) throw new AppError("VALIDATION_FAILED", "invalid line");
    if (currency && l.currency !== currency) throw new AppError("CURRENCY_MISMATCH", "Mixed currencies in one cart");
    currency = l.currency;
    total += l.unitPriceMinor * l.quantity;
    assertInt(total, "total");
  }
  return { totalMinor: total, currency };
}

/** Basis-point tax, rounded half-up on the minor unit. */
export function taxMinor(amountMinor: number, rateBps: number): number {
  assertInt(amountMinor, "amountMinor");
  assertInt(rateBps, "rateBps");
  return Math.floor((amountMinor * rateBps + 5000) / 10000);
}

const DIGITS: Record<string, number> = { JPY: 0, KWD: 3, BHD: 3 };

export function formatMoney(amountMinor: number, currency: string, locale = "en-US"): string {
  const digits = DIGITS[currency] ?? 2;
  return new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: digits }).format(amountMinor / 10 ** digits);
}
