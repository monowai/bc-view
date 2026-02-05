import {
  computeWeightInfo,
  computeCurrentPositionWeight,
  calculateQuantityFromTargetWeight,
  calculateQuantityFromTradeValue,
  buildEditModeValues,
  buildQuickSellValues,
  buildCreateModeValues,
  buildInitialSettlementAccount,
  filterBankAccountsByCurrency,
  buildAllCashBalances,
  buildDefaultCashAsset,
  resolveBrokerSettlementAccount,
  brokerHasSettlementForCurrency,
} from "./tradeFormHelpers"
import { Transaction } from "types/beancounter"

describe("tradeFormHelpers", () => {
  describe("computeWeightInfo", () => {
    test("returns null when quantity is 0", () => {
      expect(
        computeWeightInfo({
          quantity: 0,
          price: 100,
          tax: 0,
          fees: 0,
          tradeType: "BUY",
          portfolioMarketValue: 10000,
          actualPositionQuantity: 0,
        }),
      ).toBeNull()
    })

    test("returns null when price is 0", () => {
      expect(
        computeWeightInfo({
          quantity: 10,
          price: 0,
          tax: 0,
          fees: 0,
          tradeType: "BUY",
          portfolioMarketValue: 10000,
          actualPositionQuantity: 0,
        }),
      ).toBeNull()
    })

    test("returns null when portfolio market value is 0", () => {
      expect(
        computeWeightInfo({
          quantity: 10,
          price: 100,
          tax: 0,
          fees: 0,
          tradeType: "BUY",
          portfolioMarketValue: 0,
          actualPositionQuantity: 0,
        }),
      ).toBeNull()
    })

    test("SELL with existing position returns new weight and trade weight", () => {
      const result = computeWeightInfo({
        quantity: 50,
        price: 10,
        tax: 0,
        fees: 0,
        tradeType: "SELL",
        portfolioMarketValue: 10000,
        actualPositionQuantity: 100,
      })
      expect(result).toEqual({
        label: "New Weight",
        value: 5, // 50 remaining * 10 / 10000 = 5%
        tradeWeight: 5, // 500 / 10000 = 5%
      })
    })

    test("BUY with existing position returns new weight and trade weight", () => {
      const result = computeWeightInfo({
        quantity: 50,
        price: 10,
        tax: 0,
        fees: 0,
        tradeType: "BUY",
        portfolioMarketValue: 10000,
        actualPositionQuantity: 100,
      })
      // current value = 100 * 10 = 1000, trade = 50 * 10 = 500
      // new value = 1500, new weight = 15%
      expect(result).toEqual({
        label: "New Weight",
        value: 15,
        tradeWeight: 5,
      })
    })

    test("BUY without existing position returns trade weight only", () => {
      const result = computeWeightInfo({
        quantity: 10,
        price: 100,
        tax: 0,
        fees: 0,
        tradeType: "BUY",
        portfolioMarketValue: 10000,
        actualPositionQuantity: 0,
      })
      expect(result).toEqual({
        label: "Trade Weight",
        value: 10, // 1000 / 10000 = 10%
      })
    })

    test("SELL without existing position returns selling weight", () => {
      const result = computeWeightInfo({
        quantity: 10,
        price: 100,
        tax: 0,
        fees: 0,
        tradeType: "SELL",
        portfolioMarketValue: 10000,
        actualPositionQuantity: 0,
      })
      expect(result).toEqual({
        label: "Selling",
        value: 10,
      })
    })

    test("returns null for DIVI type", () => {
      expect(
        computeWeightInfo({
          quantity: 10,
          price: 1,
          tax: 0,
          fees: 0,
          tradeType: "DIVI",
          portfolioMarketValue: 10000,
          actualPositionQuantity: 100,
        }),
      ).toBeNull()
    })

    test("includes fees in trade amount for BUY", () => {
      const result = computeWeightInfo({
        quantity: 10,
        price: 100,
        tax: 0,
        fees: 10,
        tradeType: "BUY",
        portfolioMarketValue: 10000,
        actualPositionQuantity: 0,
      })
      // tradeAmount = 10 * 100 + 10 = 1010
      expect(result!.value).toBeCloseTo(10.1, 1)
    })
  })

  describe("computeCurrentPositionWeight", () => {
    test("returns weight percentage for valid inputs", () => {
      expect(computeCurrentPositionWeight(100, 10, 10000)).toBe(10)
    })

    test("returns null when positionQuantity is 0", () => {
      expect(computeCurrentPositionWeight(0, 10, 10000)).toBeNull()
    })

    test("returns null when price is 0", () => {
      expect(computeCurrentPositionWeight(100, 0, 10000)).toBeNull()
    })

    test("returns null when portfolioMarketValue is 0", () => {
      expect(computeCurrentPositionWeight(100, 10, 0)).toBeNull()
    })
  })

  describe("calculateQuantityFromTargetWeight", () => {
    test("calculates shares to buy when target > current", () => {
      const result = calculateQuantityFromTargetWeight(15, 10, 10, 10000)
      // target value = 15% of 10000 = 1500, current = 10% of 10000 = 1000
      // diff = 500, shares = round(500 / 10) = 50
      expect(result).toEqual({ quantity: 50, tradeType: "BUY" })
    })

    test("calculates shares to sell when target < current", () => {
      const result = calculateQuantityFromTargetWeight(5, 10, 10, 10000)
      // target = 500, current = 1000, diff = -500, shares = 50
      expect(result).toEqual({ quantity: 50, tradeType: "SELL" })
    })

    test("returns null when price is 0", () => {
      expect(calculateQuantityFromTargetWeight(10, 5, 0, 10000)).toBeNull()
    })

    test("returns null when portfolio value is 0", () => {
      expect(calculateQuantityFromTargetWeight(10, 5, 10, 0)).toBeNull()
    })

    test("returns null for NaN target weight", () => {
      expect(calculateQuantityFromTargetWeight(NaN, 5, 10, 10000)).toBeNull()
    })
  })

  describe("calculateQuantityFromTradeValue", () => {
    test("calculates quantity from investment value", () => {
      expect(calculateQuantityFromTradeValue(1000, 10)).toBe(100)
    })

    test("floors partial shares", () => {
      expect(calculateQuantityFromTradeValue(1050, 10)).toBe(105)
    })

    test("returns null when price is 0", () => {
      expect(calculateQuantityFromTradeValue(1000, 0)).toBeNull()
    })

    test("returns null when price is negative", () => {
      expect(calculateQuantityFromTradeValue(1000, -10)).toBeNull()
    })

    test("returns null for NaN value", () => {
      expect(calculateQuantityFromTradeValue(NaN, 10)).toBeNull()
    })
  })

  describe("buildEditModeValues", () => {
    const baseTransaction: Transaction = {
      id: "trn-1",
      callerRef: { provider: "MANUAL", batch: "20240115", callerId: "" },
      trnType: "BUY",
      status: "SETTLED",
      portfolio: {
        id: "p1",
        code: "TEST",
        name: "Test Portfolio",
        currency: { code: "NZD", name: "NZ Dollar", symbol: "$" },
        base: { code: "NZD", name: "NZ Dollar", symbol: "$" },
        marketValue: 10000,
        irr: 0.05,
      },
      asset: {
        id: "a1",
        code: "AAPL",
        name: "Apple Inc",
        assetCategory: { id: "1", name: "Equity" },
        market: {
          code: "NASDAQ",
          name: "NASDAQ",
          currency: { code: "USD", name: "US Dollar", symbol: "$" },
        },
      },
      tradeDate: "2024-01-15",
      quantity: 10,
      price: 150,
      tradeCurrency: { code: "USD", name: "US Dollar", symbol: "$" },
      tradeAmount: 1500,
      tradeBaseRate: 1,
      tradePortfolioRate: 1,
      cashCurrency: "USD",
      cashAmount: -1500,
      tradeCashRate: 1,
      fees: 5,
      tax: 0,
      comments: "Test trade",
    }

    test("maps transaction fields to form values", () => {
      const result = buildEditModeValues(baseTransaction)
      expect(result.type).toEqual({ value: "BUY", label: "BUY" })
      expect(result.status).toEqual({ value: "SETTLED", label: "SETTLED" })
      expect(result.tradeDate).toBe("2024-01-15")
      expect(result.quantity).toBe(10)
      expect(result.price).toBe(150)
      expect(result.tradeCurrency).toEqual({ value: "USD", label: "USD" })
      expect(result.tradeAmount).toBe(1500)
      expect(result.cashAmount).toBe(-1500)
      expect(result.fees).toBe(5)
      expect(result.tax).toBe(0)
      expect(result.comment).toBe("Test trade")
    })

    test("maps broker ID when present", () => {
      const trn = {
        ...baseTransaction,
        broker: { id: "b1", name: "Test Broker" },
      }
      const result = buildEditModeValues(trn)
      expect(result.brokerId).toBe("b1")
    })

    test("defaults brokerId to empty when no broker", () => {
      const result = buildEditModeValues(baseTransaction)
      expect(result.brokerId).toBe("")
    })
  })

  describe("buildQuickSellValues", () => {
    test("maps quick sell data with defaults", () => {
      const defaults = {
        type: { value: "BUY", label: "BUY" },
        status: { value: "PROPOSED", label: "PROPOSED" },
        asset: "",
        market: "US",
        tradeDate: "2024-01-15",
        quantity: 0,
        price: 0,
        tradeCurrency: { value: "USD", label: "USD" },
        settlementAccount: { value: "", label: "", currency: "" },
        tradeAmount: 0,
        cashAmount: 0,
        fees: 0,
        tax: 0,
        comment: "",
        brokerId: "",
      }
      const quickSell = {
        asset: "AAPL",
        market: "NASDAQ",
        quantity: 50,
        price: 150,
        type: "SELL" as const,
      }
      const result = buildQuickSellValues(quickSell, defaults)
      expect(result.type).toEqual({ value: "SELL", label: "SELL" })
      expect(result.asset).toBe("AAPL")
      expect(result.market).toBe("NASDAQ")
      expect(result.quantity).toBe(50)
      expect(result.price).toBe(150)
    })

    test("defaults tradeType to SELL when not specified", () => {
      const defaults = {
        type: { value: "BUY", label: "BUY" },
        status: { value: "PROPOSED", label: "PROPOSED" },
        asset: "",
        market: "US",
        tradeDate: "2024-01-15",
        quantity: 0,
        price: 0,
        tradeCurrency: { value: "USD", label: "USD" },
        settlementAccount: { value: "", label: "", currency: "" },
        tradeAmount: 0,
        cashAmount: 0,
        fees: 0,
        tax: 0,
        comment: "",
        brokerId: "",
      }
      const quickSell = {
        asset: "AAPL",
        market: "NASDAQ",
        quantity: 50,
        price: 150,
      }
      const result = buildQuickSellValues(quickSell, defaults)
      expect(result.type).toEqual({ value: "SELL", label: "SELL" })
    })
  })

  describe("buildCreateModeValues", () => {
    test("creates fresh form values with portfolio defaults", () => {
      const defaults = {
        type: { value: "BUY", label: "BUY" },
        status: { value: "PROPOSED", label: "PROPOSED" },
        asset: "",
        market: "US",
        tradeDate: "2024-01-15",
        quantity: 0,
        price: 0,
        tradeCurrency: { value: "USD", label: "USD" },
        settlementAccount: { value: "", label: "", currency: "" },
        tradeAmount: 0,
        cashAmount: 0,
        fees: 0,
        tax: 0,
        comment: "",
        brokerId: "",
      }
      const result = buildCreateModeValues(defaults, "NZX", "NZD")
      expect(result.market).toBe("NZX")
      expect(result.tradeCurrency).toEqual({ value: "NZD", label: "NZD" })
    })
  })

  describe("buildInitialSettlementAccount", () => {
    test("returns null when transaction has no cashAsset", () => {
      const trn = {
        cashAsset: undefined,
        tradeCurrency: { code: "USD", name: "US Dollar", symbol: "$" },
      }
      expect(buildInitialSettlementAccount(trn as any)).toBeNull()
    })

    test("builds option from cashAsset with name", () => {
      const trn = {
        cashAsset: {
          id: "ca1",
          code: "SCB-USD",
          name: "SCB USD Account",
          market: { code: "PRIVATE" },
          priceSymbol: "USD",
        },
        tradeCurrency: { code: "USD", name: "US Dollar", symbol: "$" },
      }
      const result = buildInitialSettlementAccount(trn as any)
      expect(result).toEqual({
        value: "ca1",
        label: "SCB USD Account",
        currency: "USD",
        market: "PRIVATE",
      })
    })

    test("builds label from code for CASH market assets", () => {
      const trn = {
        cashAsset: {
          id: "ca2",
          code: "USD",
          name: "",
          market: { code: "CASH" },
          priceSymbol: "USD",
        },
        tradeCurrency: { code: "USD", name: "US Dollar", symbol: "$" },
      }
      const result = buildInitialSettlementAccount(trn as any)
      expect(result!.label).toContain("USD")
      expect(result!.label).toContain("Balance")
    })
  })

  describe("filterBankAccountsByCurrency", () => {
    const accounts = [
      {
        id: "a1",
        code: "SCB-USD",
        name: "SCB USD",
        market: { code: "PRIVATE" },
        priceSymbol: "USD",
      },
      {
        id: "a2",
        code: "SCB-SGD",
        name: "SCB SGD",
        market: { code: "PRIVATE" },
        priceSymbol: "SGD",
      },
      {
        id: "a3",
        code: "WISE-USD",
        name: "WISE USD",
        market: { code: "PRIVATE" },
        priceSymbol: "USD",
      },
    ]

    test("filters accounts matching currency", () => {
      const result = filterBankAccountsByCurrency(accounts, "USD")
      expect(result).toHaveLength(2)
      expect(result.map((a: any) => a.code)).toEqual(["SCB-USD", "WISE-USD"])
    })

    test("sorts filtered accounts alphabetically by name", () => {
      const result = filterBankAccountsByCurrency(accounts, "USD")
      expect(result[0].name).toBe("SCB USD")
      expect(result[1].name).toBe("WISE USD")
    })

    test("returns empty array when no match", () => {
      expect(filterBankAccountsByCurrency(accounts, "GBP")).toEqual([])
    })
  })

  describe("buildAllCashBalances", () => {
    test("merges existing and synthetic cash balances", () => {
      const existing = [
        { id: "c1", code: "USD", name: "USD", market: { code: "CASH" } },
      ]
      const currencies = ["USD", "NZD", "SGD"]
      const result = buildAllCashBalances(existing, currencies, "USD")
      expect(result).toHaveLength(3)
    })

    test("uses existing assets when available", () => {
      const existing = [
        { id: "c1", code: "USD", name: "US Dollar", market: { code: "CASH" } },
      ]
      const currencies = ["USD", "NZD"]
      const result = buildAllCashBalances(existing, currencies, "USD")
      const usd = result.find((a: any) => a.code === "USD")!
      expect(usd.id).toBe("c1")
      expect(usd.name).toBe("US Dollar")
    })

    test("creates synthetic entries for missing currencies", () => {
      const existing: any[] = []
      const currencies = ["NZD"]
      const result = buildAllCashBalances(existing, currencies, "NZD")
      expect(result[0]).toEqual({
        id: "",
        code: "NZD",
        name: "NZD",
        market: { code: "CASH" },
      })
    })

    test("sorts matching currency first", () => {
      const existing: any[] = []
      const currencies = ["AUD", "NZD", "USD"]
      const result = buildAllCashBalances(existing, currencies, "NZD")
      expect(result[0].code).toBe("NZD")
    })
  })

  describe("buildDefaultCashAsset", () => {
    test("returns first matching cash asset as settlement option", () => {
      const filtered = [
        { id: "c1", code: "NZD", name: "NZD", market: { code: "CASH" } },
      ]
      const result = buildDefaultCashAsset(filtered, "NZD")
      expect(result).toEqual({
        value: "c1",
        label: "NZD Balance",
        currency: "NZD",
        market: "CASH",
      })
    })

    test("returns synthetic fallback when no match", () => {
      const result = buildDefaultCashAsset([], "GBP")
      expect(result).toEqual({
        value: "",
        label: "GBP Balance",
        currency: "GBP",
        market: "CASH",
      })
    })
  })

  describe("resolveBrokerSettlementAccount", () => {
    const brokers = [
      {
        id: "b1",
        name: "Broker1",
        settlementAccounts: [
          { currencyCode: "USD", accountId: "a1" },
          { currencyCode: "NZD", accountId: "a2" },
        ],
      },
    ]
    const allBankAccounts = [
      {
        id: "a1",
        code: "SCB-USD",
        name: "SCB USD",
        market: { code: "PRIVATE" },
        priceSymbol: "USD",
      },
      {
        id: "a2",
        code: "KIWI-NZD",
        name: "Kiwi NZD",
        market: { code: "PRIVATE" },
        priceSymbol: "NZD",
      },
    ]

    test("resolves settlement account for broker and currency", () => {
      const result = resolveBrokerSettlementAccount({
        brokerId: "b1",
        tradeCurrency: "USD",
        brokers: brokers as any,
        allBankAccounts,
      })
      expect(result).toEqual({
        value: "a1",
        label: "SCB USD",
        currency: "USD",
      })
    })

    test("returns null when broker not found", () => {
      const result = resolveBrokerSettlementAccount({
        brokerId: "unknown",
        tradeCurrency: "USD",
        brokers: brokers as any,
        allBankAccounts,
      })
      expect(result).toBeNull()
    })

    test("falls back to first settlement account when no currency match", () => {
      const result = resolveBrokerSettlementAccount({
        brokerId: "b1",
        tradeCurrency: "GBP",
        brokers: brokers as any,
        allBankAccounts,
      })
      expect(result).toEqual({
        value: "a1",
        label: "SCB USD",
        currency: "USD",
      })
    })

    test("returns null when bank account not found", () => {
      const result = resolveBrokerSettlementAccount({
        brokerId: "b1",
        tradeCurrency: "USD",
        brokers: brokers as any,
        allBankAccounts: [], // No bank accounts
      })
      expect(result).toBeNull()
    })

    test("returns null when broker has empty settlementAccounts", () => {
      const emptyBrokers = [{ id: "b2", name: "Empty", settlementAccounts: [] }]
      const result = resolveBrokerSettlementAccount({
        brokerId: "b2",
        tradeCurrency: "USD",
        brokers: emptyBrokers as any,
        allBankAccounts,
      })
      expect(result).toBeNull()
    })
  })

  describe("brokerHasSettlementForCurrency", () => {
    const brokers = [
      {
        id: "b1",
        name: "Broker1",
        settlementAccounts: [{ currencyCode: "USD", accountId: "a1" }],
      },
    ]

    test("returns true when broker has settlement for currency", () => {
      expect(
        brokerHasSettlementForCurrency({
          brokerId: "b1",
          tradeCurrency: "USD",
          brokers: brokers as any,
        }),
      ).toBe(true)
    })

    test("returns false when no settlement for currency", () => {
      expect(
        brokerHasSettlementForCurrency({
          brokerId: "b1",
          tradeCurrency: "GBP",
          brokers: brokers as any,
        }),
      ).toBe(false)
    })

    test("returns false when broker not found", () => {
      expect(
        brokerHasSettlementForCurrency({
          brokerId: "unknown",
          tradeCurrency: "USD",
          brokers: brokers as any,
        }),
      ).toBe(false)
    })
  })
})
