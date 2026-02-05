import {
  AssetOption,
  buildCombinedAssetOptions,
  resolveFxCurrencyPair,
  resolveAssetSelection,
  calculateFxBuyAmount,
  filterFxBuyOptions,
  buildCashCopyData,
  resolveFxDisplayInfo,
} from "./cashFormHelpers"
import { Asset, Currency } from "types/beancounter"

const makeCurrency = (code: string): Currency => ({
  code,
  name: code,
  symbol: code,
})

const makeAsset = (
  id: string,
  code: string,
  name: string,
  priceSymbol: string,
  marketCode = "PRIVATE",
): Asset => ({
  id,
  code,
  name,
  priceSymbol,
  assetCategory: { id: "ACCOUNT", name: "Account" },
  market: {
    code: marketCode,
    name: marketCode,
    currency: { code: priceSymbol, name: priceSymbol, symbol: priceSymbol },
  },
})

describe("cashFormHelpers", () => {
  describe("buildCombinedAssetOptions", () => {
    const currencies: Currency[] = [makeCurrency("USD"), makeCurrency("NZD")]

    const accounts: Record<string, Asset> = {
      a1: makeAsset("uuid-1", "owner.SCB-USD", "SCB USD", "USD"),
      a2: makeAsset("uuid-2", "owner.KiwiBank", "Kiwi Bank", "NZD"),
    }

    const tradeAccounts: Record<string, Asset> = {
      t1: makeAsset("uuid-3", "owner.IBKR", "Interactive Brokers", "USD"),
    }

    test("builds currency options with market CASH", () => {
      const result = buildCombinedAssetOptions(currencies, undefined, undefined)
      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        value: "USD",
        label: "USD",
        market: "CASH",
        currency: "USD",
      })
      expect(result[1]).toEqual({
        value: "NZD",
        label: "NZD",
        market: "CASH",
        currency: "NZD",
      })
    })

    test("builds account options with market PRIVATE", () => {
      const result = buildCombinedAssetOptions(undefined, accounts, undefined)
      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({
        value: "SCB-USD",
        label: "SCB USD (USD)",
        market: "PRIVATE",
        currency: "USD",
        assetId: "uuid-1",
      })
      expect(result[1]).toMatchObject({
        value: "KiwiBank",
        label: "Kiwi Bank (NZD)",
        market: "PRIVATE",
        currency: "NZD",
        assetId: "uuid-2",
      })
    })

    test("builds trade account options with market TRADE", () => {
      const result = buildCombinedAssetOptions(
        undefined,
        undefined,
        tradeAccounts,
      )
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        value: "IBKR",
        label: "Interactive Brokers (USD)",
        market: "TRADE",
        currency: "USD",
        assetId: "uuid-3",
      })
    })

    test("combines all three sources", () => {
      const result = buildCombinedAssetOptions(
        currencies,
        accounts,
        tradeAccounts,
      )
      expect(result).toHaveLength(5)
      expect(result.filter((o) => o.market === "CASH")).toHaveLength(2)
      expect(result.filter((o) => o.market === "PRIVATE")).toHaveLength(2)
      expect(result.filter((o) => o.market === "TRADE")).toHaveLength(1)
    })

    test("returns empty array when all sources are undefined", () => {
      const result = buildCombinedAssetOptions(undefined, undefined, undefined)
      expect(result).toEqual([])
    })

    test("strips owner prefix from account codes", () => {
      const result = buildCombinedAssetOptions(undefined, accounts, undefined)
      expect(result[0].value).toBe("SCB-USD")
      expect(result[1].value).toBe("KiwiBank")
    })

    test("uses priceSymbol for account currency", () => {
      const result = buildCombinedAssetOptions(undefined, accounts, undefined)
      expect(result[0].currency).toBe("USD")
    })

    test("falls back to market currency when priceSymbol missing", () => {
      const noSymbol: Record<string, Asset> = {
        x: {
          ...makeAsset("uuid-x", "owner.Test", "Test Acct", ""),
          priceSymbol: undefined,
        },
      }
      const result = buildCombinedAssetOptions(undefined, noSymbol, undefined)
      // priceSymbol is undefined, market.currency.code is "" (falsy), so falls to "?"
      expect(result[0].currency).toBe("?")
    })
  })

  describe("resolveFxCurrencyPair", () => {
    const options: AssetOption[] = [
      { value: "USD", label: "USD", market: "CASH", currency: "USD" },
      { value: "NZD", label: "NZD", market: "CASH", currency: "NZD" },
      {
        value: "SCB-USD",
        label: "SCB USD (USD)",
        market: "PRIVATE",
        currency: "USD",
        assetId: "uuid-1",
      },
      {
        value: "KiwiBank",
        label: "Kiwi Bank (NZD)",
        market: "PRIVATE",
        currency: "NZD",
        assetId: "uuid-2",
      },
    ]

    test("resolves currency pair for currency-to-currency", () => {
      const result = resolveFxCurrencyPair("USD", "NZD", options)
      expect(result).toEqual({ sellCurrency: "USD", buyCurrency: "NZD" })
    })

    test("resolves currency pair for currency-to-account", () => {
      const result = resolveFxCurrencyPair("USD", "KiwiBank", options)
      expect(result).toEqual({ sellCurrency: "USD", buyCurrency: "NZD" })
    })

    test("resolves currency pair for account-to-currency", () => {
      const result = resolveFxCurrencyPair("SCB-USD", "NZD", options)
      expect(result).toEqual({ sellCurrency: "USD", buyCurrency: "NZD" })
    })

    test("returns null when same currency", () => {
      const result = resolveFxCurrencyPair("USD", "SCB-USD", options)
      expect(result).toBeNull()
    })

    test("returns null when sell asset not found", () => {
      const result = resolveFxCurrencyPair("UNKNOWN", "NZD", options)
      expect(result).toBeNull()
    })

    test("uses cashCurrencyValue as fallback buy currency", () => {
      const result = resolveFxCurrencyPair("USD", "GBP", options)
      // GBP not in options, so buyCurrency = cashCurrencyValue = "GBP"
      expect(result).toEqual({ sellCurrency: "USD", buyCurrency: "GBP" })
    })
  })

  describe("resolveAssetSelection", () => {
    const options: AssetOption[] = [
      { value: "USD", label: "USD", market: "CASH", currency: "USD" },
      {
        value: "SCB-USD",
        label: "SCB USD",
        market: "PRIVATE",
        currency: "USD",
      },
    ]

    test("resolves cash currency", () => {
      const result = resolveAssetSelection("USD", options)
      expect(result).toEqual({ market: "CASH", currency: "USD" })
    })

    test("resolves bank account", () => {
      const result = resolveAssetSelection("SCB-USD", options)
      expect(result).toEqual({ market: "PRIVATE", currency: "USD" })
    })

    test("returns null for unknown asset", () => {
      const result = resolveAssetSelection("UNKNOWN", options)
      expect(result).toBeNull()
    })

    test("defaults market to CASH when option has no market", () => {
      const opts: AssetOption[] = [{ value: "X", label: "X" }]
      const result = resolveAssetSelection("X", opts)
      expect(result).toEqual({ market: "CASH", currency: "X" })
    })
  })

  describe("calculateFxBuyAmount", () => {
    test("multiplies quantity by rate", () => {
      expect(calculateFxBuyAmount(1000, 1.5)).toBe(1500)
    })

    test("rounds to 2 decimal places", () => {
      expect(calculateFxBuyAmount(100, 1.555)).toBe(155.5)
    })

    test("handles zero quantity", () => {
      expect(calculateFxBuyAmount(0, 1.5)).toBe(0)
    })

    test("handles fractional quantities", () => {
      expect(calculateFxBuyAmount(33.33, 1.2)).toBe(40)
    })
  })

  describe("filterFxBuyOptions", () => {
    const options: AssetOption[] = [
      { value: "USD", label: "USD", market: "CASH", currency: "USD" },
      { value: "NZD", label: "NZD", market: "CASH", currency: "NZD" },
      {
        value: "SCB-USD",
        label: "SCB USD",
        market: "PRIVATE",
        currency: "USD",
      },
      {
        value: "KiwiBank",
        label: "Kiwi Bank",
        market: "PRIVATE",
        currency: "NZD",
      },
    ]

    test("filters out options with same currency as sell", () => {
      const result = filterFxBuyOptions(options, "USD")
      expect(result).toHaveLength(2)
      expect(result.every((o) => o.currency !== "USD")).toBe(true)
    })

    test("returns all options when sell currency is undefined", () => {
      const result = filterFxBuyOptions(options, undefined)
      expect(result).toHaveLength(4)
    })

    test("returns all options when no currency matches", () => {
      const result = filterFxBuyOptions(options, "GBP")
      expect(result).toHaveLength(4)
    })
  })

  describe("buildCashCopyData", () => {
    test("adds market and price=1, maps comment to comments", () => {
      const formData = {
        type: { value: "DEPOSIT", label: "DEPOSIT" },
        asset: "USD",
        quantity: 500,
        comment: "Test deposit",
      }
      const result = buildCashCopyData(formData, "CASH")
      expect(result.market).toBe("CASH")
      expect(result.price).toBe(1)
      expect(result.comments).toBe("Test deposit")
    })

    test("maps null comment to undefined comments", () => {
      const formData = { comment: null }
      const result = buildCashCopyData(formData, "CASH")
      expect(result.comments).toBeUndefined()
    })

    test("maps missing comment to undefined comments", () => {
      const formData = {}
      const result = buildCashCopyData(formData, "PRIVATE")
      expect(result.comments).toBeUndefined()
      expect(result.market).toBe("PRIVATE")
    })

    test("preserves original form fields", () => {
      const formData = {
        type: { value: "FX", label: "FX" },
        quantity: 1000,
        comment: "",
      }
      const result = buildCashCopyData(formData, "CASH")
      expect(result.type).toEqual({ value: "FX", label: "FX" })
      expect(result.quantity).toBe(1000)
    })
  })

  describe("resolveFxDisplayInfo", () => {
    const options: AssetOption[] = [
      { value: "USD", label: "USD", market: "CASH", currency: "USD" },
      { value: "NZD", label: "NZD", market: "CASH", currency: "NZD" },
      {
        value: "SCB-USD",
        label: "SCB USD (USD)",
        market: "PRIVATE",
        currency: "USD",
      },
    ]

    test("returns currency code for CASH options", () => {
      const result = resolveFxDisplayInfo("USD", options)
      expect(result).toEqual({ label: "USD", isCash: true })
    })

    test("returns full label for account options", () => {
      const result = resolveFxDisplayInfo("SCB-USD", options)
      expect(result).toEqual({ label: "SCB USD (USD)", isCash: false })
    })

    test("returns value as fallback for unknown options", () => {
      const result = resolveFxDisplayInfo("GBP", options)
      expect(result).toEqual({ label: "GBP", isCash: true })
    })
  })
})
