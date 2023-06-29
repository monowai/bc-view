import { Currency, CurrencyOption } from "@core/types/beancounter";

// export const usd: CurrencyOption = { value: "USD", label: "USD" };
export function currencyOptions(currencies: Currency[]): CurrencyOption[] {
  return currencies.map((currency) => {
    return { value: currency.code, label: currency.code };
  });
}
export function toCurrencyOption(currency: Currency): CurrencyOption {
  return { value: currency.code, label: currency.code };
}

export function toCurrency(id: string, currencies: Currency[]): CurrencyOption {
  const currency = currencies.filter((option) => option.code === id);
  return toCurrencyOption(currency[0]);
}
