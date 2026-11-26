import { Asset, Currency, CurrencyOption } from "types/beancounter"
import { getAssetCurrency } from "@lib/assets/assetUtils"
import { currencyOptions } from "@lib/currency"

/** Extended option that includes market info for accounts */
export interface AssetOption extends CurrencyOption {
  market?: string
  currency?: string
  assetId?: string
}

/**
 * Build combined dropdown options from currencies, bank accounts, and trade accounts.
 * Currencies get market "CASH", accounts get "PRIVATE" or "TRADE".
 */
export const buildCombinedAssetOptions = (
  currencies: Currency[] | undefined,
  accounts: Record<string, Asset> | undefined,
  tradeAccounts: Record<string, Asset> | undefined,
): AssetOption[] => {
  const options: AssetOption[] = []

  if (currencies) {
    currencyOptions(currencies).forEach((opt: CurrencyOption) => {
      options.push({ ...opt, market: "CASH", currency: opt.value })
    })
  }

  if (accounts) {
    Object.values(accounts).forEach((account) => {
      const accountCurrency = getAssetCurrency(account) || "?"
      options.push({
        value: account.displayCode,
        label: `${account.name} (${accountCurrency})`,
        market: "PRIVATE",
        currency: accountCurrency,
        assetId: account.id,
      })
    })
  }

  if (tradeAccounts) {
    Object.values(tradeAccounts).forEach((account) => {
      const accountCurrency = getAssetCurrency(account) || "?"
      options.push({
        value: account.displayCode,
        label: `${account.name} (${accountCurrency})`,
        market: "TRADE",
        currency: accountCurrency,
        assetId: account.id,
      })
    })
  }

  return options
}

/**
 * Resolve FX currency pair from selected asset and cash currency.
 * Returns null if currencies are missing or identical.
 */
export const resolveFxCurrencyPair = (
  asset: string,
  cashCurrencyValue: string,
  combinedOptions: AssetOption[],
): { sellCurrency: string; buyCurrency: string } | null => {
  const sellCurrency = combinedOptions.find(
    (opt) => opt.value === asset,
  )?.currency

  const buyOption = combinedOptions.find(
    (opt) => opt.value === cashCurrencyValue,
  )
  const buyCurrency = buyOption?.currency || cashCurrencyValue

  if (!sellCurrency || sellCurrency === buyCurrency) return null

  return { sellCurrency, buyCurrency }
}

/**
 * Resolve market and currency for a selected asset option.
 * Returns null if no matching option found.
 */
export const resolveAssetSelection = (
  asset: string,
  combinedOptions: AssetOption[],
): { market: string; currency: string } | null => {
  const selected = combinedOptions.find((opt) => opt.value === asset)
  if (!selected) return null
  return {
    market: selected.market || "CASH",
    currency: selected.currency || asset,
  }
}

/**
 * Calculate FX buy amount from quantity and rate, rounded to 2 decimal places.
 */
export const calculateFxBuyAmount = (
  quantity: number,
  fxRate: number,
): number => parseFloat((quantity * fxRate).toFixed(2))

/**
 * Filter combined options to exclude same-currency options for the FX buy side.
 */
export const filterFxBuyOptions = (
  combinedOptions: AssetOption[],
  sellCurrency: string | undefined,
): AssetOption[] =>
  combinedOptions.filter((opt) => opt.currency !== sellCurrency)

/**
 * The FX buy side as the form stores it. The row it posts needs the option's
 * currency (an account's value is its code) and market, not just its value.
 */
export const fxBuyChoice = (
  option: AssetOption,
): { value: string; label: string; currency: string; market: string } => ({
  value: option.value,
  label: option.label,
  currency: option.currency ?? option.value,
  market: option.market ?? "CASH",
})

/**
 * Build copy data from cash form values for the convert() function.
 * Adds market, forces price=1, and maps comment→comments.
 */
export const buildCashCopyData = <T extends { comment?: string | null }>(
  formData: T,
  selectedMarket: string,
): T & { market: string; price: number; comments: string | undefined } => ({
  ...formData,
  market: selectedMarket,
  price: 1,
  comments: formData.comment ?? undefined,
})

/**
 * Resolve display info for an option in the FX summary.
 * Returns the display label and whether it's a plain currency.
 */
export const resolveFxDisplayInfo = (
  optionValue: string,
  combinedOptions: AssetOption[],
): { label: string; isCash: boolean } => {
  const opt = combinedOptions.find((o) => o.value === optionValue)
  if (!opt) return { label: optionValue, isCash: true }
  const isCash = opt.market === "CASH"
  return {
    label: isCash ? optionValue : opt.label || optionValue,
    isCash,
  }
}

export interface AssetOptionGroup {
  label: string
  options: AssetOption[]
}

const OPTION_GROUPS: { market: string; label: string }[] = [
  { market: "CASH", label: "Currencies" },
  { market: "PRIVATE", label: "Bank accounts" },
  { market: "TRADE", label: "Trade accounts" },
]

/**
 * Groups account options for a select: currencies, then bank accounts, then
 * trade accounts. Groups with nothing in them are left out.
 */
export const groupAssetOptions = (options: AssetOption[]): AssetOptionGroup[] =>
  OPTION_GROUPS.map(({ market, label }) => ({
    label,
    options: options.filter((opt) => (opt.market || "CASH") === market),
  })).filter((group) => group.options.length > 0)

export interface CashType {
  value: "DEPOSIT" | "WITHDRAWAL" | "INCOME" | "DEDUCTION" | "FX"
  label: string
  /** The dialog title while this type is chosen. */
  title: string
  /** Which way the money moves through the account. */
  flow: "in" | "out"
}

export const CASH_TYPES: readonly CashType[] = [
  { value: "DEPOSIT", label: "Deposit", title: "Deposit cash", flow: "in" },
  {
    value: "WITHDRAWAL",
    label: "Withdrawal",
    title: "Withdraw cash",
    flow: "out",
  },
  { value: "INCOME", label: "Income", title: "Record income", flow: "in" },
  {
    value: "DEDUCTION",
    label: "Deduction",
    title: "Record a deduction",
    flow: "out",
  },
  { value: "FX", label: "FX", title: "Exchange currency", flow: "out" },
]

/** The cash type for a transaction type code; unknown codes read as a deposit. */
export const cashTypeOf = (value: string): CashType =>
  CASH_TYPES.find((t) => t.value === value) ?? CASH_TYPES[0]
