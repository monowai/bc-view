import { Currency, CurrencyOption } from "types/beancounter"

export function currencyOptions(currencies: Currency[]): CurrencyOption[] {
  return currencies.map((currency) => {
    return { value: currency.code, label: currency.code }
  })
}

export function toCurrencyOption(currency: Currency): CurrencyOption {
  return { value: currency.code, label: currency.code }
}

export function toCurrency(id: string, currencies: Currency[]): CurrencyOption {
  const currency = currencies.filter((option) => option.code === id)
  return toCurrencyOption(currency[0])
}

/**
 * `amount` converted at `rate`, or undefined when the rate is not known.
 * A missing rate is never 1: that would show and sum an amount in one
 * currency as if it were already in another.
 */
export function convertAt(
  amount: number,
  rate: number | undefined,
): number | undefined {
  return rate === undefined ? undefined : amount * rate
}

/**
 * The sum of amounts already converted, or undefined when any of them could
 * not be converted: a total that silently drops an item is wrong too.
 */
export function sumConverted(
  amounts: (number | undefined)[],
): number | undefined {
  let total = 0
  for (const amount of amounts) {
    if (amount === undefined) return undefined
    total += amount
  }
  return total
}
