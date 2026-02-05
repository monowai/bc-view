import { Asset, Currency, CurrencyOption } from "types/beancounter"
import { stripOwnerPrefix } from "@lib/assets/assetUtils"
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
      const accountCurrency =
        account.priceSymbol || account.market?.currency?.code || "?"
      options.push({
        value: stripOwnerPrefix(account.code),
        label: `${account.name} (${accountCurrency})`,
        market: "PRIVATE",
        currency: accountCurrency,
        assetId: account.id,
      })
    })
  }

  if (tradeAccounts) {
    Object.values(tradeAccounts).forEach((account) => {
      const accountCurrency =
        account.priceSymbol || account.market?.currency?.code || "?"
      options.push({
        value: stripOwnerPrefix(account.code),
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
