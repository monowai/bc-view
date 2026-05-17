import type { Asset, Portfolio, TrnPayload } from "types/beancounter"
import {
  denormalizeTrnPayload,
  transformTrnEnvelopeJson,
} from "@utils/trns/trnsSelectors"

const usdAsset: Asset = {
  id: "USD",
  code: "USD",
  name: "US Dollar",
  market: {
    code: "CASH",
    currency: { code: "USD", name: "Dollar", symbol: "$" },
    timezone: "UTC",
    multiplier: 1,
  },
  priceSymbol: "USD",
  category: "CASH",
  assetCategory: { id: "CASH", name: "Cash" },
  status: "Active",
  version: "1",
} as unknown as Asset

const aaplAsset: Asset = {
  id: "AAPL",
  code: "AAPL",
  name: "Apple",
  market: {
    code: "NASDAQ",
    currency: { code: "USD", name: "Dollar", symbol: "$" },
    timezone: "US/Eastern",
    multiplier: 1,
  },
  priceSymbol: "AAPL",
  category: "EQUITY",
  assetCategory: { id: "EQUITY", name: "Equity" },
  status: "Active",
  version: "1",
} as unknown as Asset

const portfolio: Portfolio = {
  id: "USV",
  code: "USV",
  name: "Test",
  marketValue: 0,
  irr: 0,
  currency: { code: "USD", name: "Dollar", symbol: "$" },
  base: { code: "USD", name: "Dollar", symbol: "$" },
} as unknown as Portfolio

const envelope: TrnPayload = {
  trns: [
    {
      id: "t1",
      callerRef: null,
      trnType: "BUY",
      status: "SETTLED",
      portfolioId: "USV",
      assetId: "AAPL",
      cashAssetId: "USD",
      tradeDate: "2025-01-15",
      quantity: 10,
      price: 200,
      tradeCurrencyCode: "USD",
      tradeAmount: 2000,
      tradeBaseRate: 1,
      tradePortfolioRate: 1,
      cashCurrencyCode: "USD",
      cashAmount: -2000,
      tradeCashRate: 1,
      fees: 0,
      tax: 0,
      comments: null,
      brokerId: null,
      modelId: null,
      subAccounts: null,
    },
  ],
  assets: { AAPL: aaplAsset, USD: usdAsset },
  portfolios: { USV: portfolio },
  currencies: { USD: { code: "USD", name: "Dollar", symbol: "$" } },
  brokers: {},
}

describe("trnsSelectors", () => {
  describe("denormalizeTrnPayload", () => {
    it("re-attaches asset and portfolio from envelope maps", () => {
      const [trn] = denormalizeTrnPayload(envelope)
      expect(trn.asset).toEqual(aaplAsset)
      expect(trn.portfolio).toEqual(portfolio)
      expect(trn.cashAsset).toEqual(usdAsset)
      expect(trn.tradeCurrency.code).toBe("USD")
    })

    it("returns an empty array for missing or empty envelopes", () => {
      expect(denormalizeTrnPayload(null)).toEqual([])
      expect(denormalizeTrnPayload(undefined)).toEqual([])
      expect(
        denormalizeTrnPayload({
          trns: [],
          assets: {},
          portfolios: {},
          currencies: {},
          brokers: {},
        }),
      ).toEqual([])
    })
  })

  describe("transformTrnEnvelopeJson", () => {
    it("rewrites envelope to legacy { data: Transaction[] } shape", () => {
      const out = transformTrnEnvelopeJson({ data: envelope }) as {
        data: Array<{ id: string; asset: Asset }>
      }
      expect(out.data).toHaveLength(1)
      expect(out.data[0].asset.code).toBe("AAPL")
    })

    it("passes non-envelope payloads through unchanged", () => {
      const deleteResponse = { data: ["t1"] }
      expect(transformTrnEnvelopeJson(deleteResponse)).toBe(deleteResponse)
    })
  })
})
