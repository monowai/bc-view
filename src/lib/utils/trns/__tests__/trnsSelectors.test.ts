import type { TrnPayload } from "types/beancounter"
import {
  denormalizeTrnPayload,
  transformTrnEnvelopeJson,
} from "@utils/trns/trnsSelectors"
import {
  makeAsset,
  makeCashAsset,
  makePortfolio,
  USD,
} from "@test-fixtures/beancounter"

const aapl = makeAsset()
const usdCash = makeCashAsset(USD)
const portfolio = makePortfolio({ id: "USV", code: "USV" })

const envelope: TrnPayload = {
  trns: [
    {
      id: "t1",
      callerRef: null,
      trnType: "BUY",
      status: "SETTLED",
      portfolioId: portfolio.id,
      assetId: aapl.id,
      cashAssetId: usdCash.id,
      tradeDate: "2025-01-15",
      quantity: 10,
      price: 200,
      tradeCurrencyCode: USD.code,
      tradeAmount: 2000,
      tradeBaseRate: 1,
      tradePortfolioRate: 1,
      cashCurrencyCode: USD.code,
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
  assets: { [aapl.id]: aapl, [usdCash.id]: usdCash },
  portfolios: { [portfolio.id]: portfolio },
  currencies: { [USD.code]: USD },
  brokers: {},
}

describe("trnsSelectors", () => {
  describe("denormalizeTrnPayload", () => {
    it("re-attaches asset and portfolio from envelope maps", () => {
      const [trn] = denormalizeTrnPayload(envelope)
      expect(trn.asset).toEqual(aapl)
      expect(trn.portfolio).toEqual(portfolio)
      expect(trn.cashAsset).toEqual(usdCash)
      expect(trn.tradeCurrency.code).toBe(USD.code)
    })

    it("falls back to an empty callerRef when the envelope omits it", () => {
      const [trn] = denormalizeTrnPayload(envelope)
      expect(trn.callerRef).toEqual({ provider: "", batch: "", callerId: "" })
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

    it("throws when a required envelope reference is missing", () => {
      const broken: TrnPayload = {
        ...envelope,
        assets: {}, // strip AAPL from the envelope
      }
      expect(() => denormalizeTrnPayload(broken)).toThrow(/Invalid TrnPayload refs/)
    })

    it("throws when an optional id is dangling", () => {
      const broken: TrnPayload = {
        ...envelope,
        brokers: {},
        trns: [{ ...envelope.trns[0], brokerId: "ghost" }],
      }
      expect(() => denormalizeTrnPayload(broken)).toThrow(/brokerId=ghost/)
    })
  })

  describe("transformTrnEnvelopeJson", () => {
    it("rewrites envelope to legacy { data: Transaction[] } shape", () => {
      const out = transformTrnEnvelopeJson({ data: envelope }) as {
        data: Array<{ id: string; asset: typeof aapl }>
      }
      expect(out.data).toHaveLength(1)
      expect(out.data[0].asset.code).toBe(aapl.code)
    })

    it("passes non-envelope payloads through unchanged", () => {
      const deleteResponse = { data: ["t1"] }
      expect(transformTrnEnvelopeJson(deleteResponse)).toBe(deleteResponse)
    })
  })
})
