import {
  deriveSettlementCurrency,
  buildEditPayload,
  buildExpensePayload,
  buildCreateModeData,
} from "./tradeSubmission"

describe("tradeSubmission", () => {
  describe("deriveSettlementCurrency", () => {
    test("uses settlement account currency when available", () => {
      expect(
        deriveSettlementCurrency({
          settlementAccount: { value: "a1", label: "SCB", currency: "NZD" },
          tradeCurrency: { value: "USD", label: "USD" },
        }),
      ).toBe("NZD")
    })

    test("falls back to trade currency when no settlement account", () => {
      expect(
        deriveSettlementCurrency({
          settlementAccount: null,
          tradeCurrency: { value: "SGD", label: "SGD" },
        }),
      ).toBe("SGD")
    })

    test("falls back to USD when no currency info", () => {
      expect(
        deriveSettlementCurrency({
          settlementAccount: null,
          tradeCurrency: { value: "", label: "" },
        }),
      ).toBe("USD")
    })
  })

  describe("buildEditPayload", () => {
    const baseFormData = {
      type: { value: "BUY", label: "BUY" },
      status: { value: "SETTLED", label: "SETTLED" },
      asset: "AAPL",
      market: "NASDAQ",
      tradeDate: "2024-01-15",
      quantity: 10,
      price: 150,
      tradeCurrency: { value: "USD", label: "USD" },
      settlementAccount: { value: "a1", label: "SCB USD", currency: "USD" },
      tradeAmount: 1500,
      cashAmount: -1500,
      fees: 5,
      tax: 0,
      comment: "Test",
      brokerId: "b1",
    }

    test("builds payload for BUY trade", () => {
      const result = buildEditPayload(baseFormData, "asset-id-1")
      expect(result.trnType).toBe("BUY")
      expect(result.assetId).toBe("asset-id-1")
      expect(result.tradeDate).toBe("2024-01-15")
      expect(result.quantity).toBe(10)
      expect(result.price).toBe(150)
      expect(result.tradeCurrency).toBe("USD")
      expect(result.cashCurrency).toBe("USD")
      expect(result.cashAssetId).toBe("a1")
      expect(result.fees).toBe(5)
      expect(result.tax).toBe(0)
      expect(result.comments).toBe("Test")
      expect(result.brokerId).toBe("b1")
      expect(result.status).toBe("SETTLED")
    })

    test("uses tradeAmount from form or computes from qty*price", () => {
      const result = buildEditPayload(baseFormData, "asset-id-1")
      expect(result.tradeAmount).toBe(1500)
    })

    test("computes tradeAmount when form value is 0", () => {
      const data = { ...baseFormData, tradeAmount: 0 }
      const result = buildEditPayload(data, "asset-id-1")
      expect(result.tradeAmount).toBe(10 * 150) // qty * price
    })

    test("computes cashAmount when form value is 0", () => {
      const data = { ...baseFormData, cashAmount: 0 }
      const result = buildEditPayload(data, "asset-id-1")
      expect(result.cashAmount).toBe(-(10 * 150 + 5)) // -(qty*price + fees)
    })

    test("handles EXPENSE type: quantity=1, price=tradeAmount", () => {
      const data = {
        ...baseFormData,
        type: { value: "EXPENSE", label: "EXPENSE" },
        tradeAmount: 500,
        quantity: 0,
        price: 0,
      }
      const result = buildEditPayload(data, "asset-id-1")
      expect(result.quantity).toBe(1)
      expect(result.price).toBe(500)
      expect(result.cashAmount).toBe(-500)
    })

    test("includes modelId when provided", () => {
      const result = buildEditPayload(baseFormData, "asset-id-1", "model-1")
      expect(result.modelId).toBe("model-1")
    })

    test("omits modelId when undefined", () => {
      const result = buildEditPayload(baseFormData, "asset-id-1")
      expect(result.modelId).toBeUndefined()
    })
  })

  describe("buildExpensePayload", () => {
    const formData = {
      type: { value: "EXPENSE", label: "EXPENSE" },
      status: { value: "SETTLED", label: "SETTLED" },
      asset: "APT",
      market: "PRIVATE",
      tradeDate: "2024-01-15",
      quantity: 0,
      price: 0,
      tradeCurrency: { value: "NZD", label: "NZD" },
      settlementAccount: {
        value: "kiwi-id",
        label: "Kiwi Bank",
        currency: "NZD",
      },
      tradeAmount: 500,
      cashAmount: 0,
      fees: 0,
      tax: 0,
      comment: "Insurance",
      brokerId: "",
    }

    test("builds REST payload for expense creation", () => {
      const result = buildExpensePayload(formData, "portfolio-1")
      expect(result.portfolioId).toBe("portfolio-1")
      expect(result.data).toHaveLength(1)
      const item = result.data[0]
      expect(item.assetId).toBe("APT")
      expect(item.trnType).toBe("EXPENSE")
      expect(item.quantity).toBe(1)
      expect(item.price).toBe(500)
      expect(item.tradeCurrency).toBe("NZD")
      expect(item.tradeAmount).toBe(500)
      expect(item.cashCurrency).toBe("NZD")
      expect(item.cashAssetId).toBe("kiwi-id")
      expect(item.cashAmount).toBe(-500)
      expect(item.tradeDate).toBe("2024-01-15")
      expect(item.comments).toBe("Insurance")
      expect(item.status).toBe("SETTLED")
    })

    test("defaults status to SETTLED when missing", () => {
      const data = {
        ...formData,
        status: { value: "", label: "" },
      }
      const result = buildExpensePayload(data, "portfolio-1")
      expect(result.data[0].status).toBe("SETTLED")
    })
  })

  describe("buildCreateModeData", () => {
    const formData = {
      type: { value: "BUY", label: "BUY" },
      status: { value: "PROPOSED", label: "PROPOSED" },
      asset: "AAPL",
      market: "US",
      tradeDate: "2024-01-15",
      quantity: 10,
      price: 150,
      tradeCurrency: { value: "USD", label: "USD" },
      settlementAccount: null,
      tradeAmount: 1500,
      cashAmount: -1500,
      fees: 5,
      tax: 0,
      comment: "Test",
      brokerId: "",
    }

    test("adds cashCurrency to form data", () => {
      const result = buildCreateModeData(formData, "USD")
      expect(result.cashCurrency).toEqual({ value: "USD", label: "USD" })
    })

    test("uses provided settlement currency", () => {
      const result = buildCreateModeData(formData, "NZD")
      expect(result.cashCurrency).toEqual({ value: "NZD", label: "NZD" })
    })

    test("preserves all original form data fields", () => {
      const result = buildCreateModeData(formData, "USD")
      expect(result.type).toEqual(formData.type)
      expect(result.quantity).toBe(10)
      expect(result.price).toBe(150)
    })
  })
})
