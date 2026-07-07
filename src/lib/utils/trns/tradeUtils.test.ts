import {
  calculateCashAmount,
  calculateTradeAmount,
  calculateTradeWeight,
  calculateNewPositionWeight,
  convert,
  convertToTradeImport,
  generateBatchId,
  getCashRow,
  getTradeRow,
  hasCashImpact,
  isExpenseType,
  isBuySide,
  isSellSide,
  isPositionAdjustment,
  getTradeColorScheme,
  getQtyPriceTint,
  getAssetCurrency,
  deriveDefaultMarket,
  computeTradeGroupTotals,
  buildTradeGroups,
} from "./tradeUtils"
import { TradeFormData, Transaction, TrnTradeSummary } from "types/beancounter"

describe("TradeUtils", () => {
  test("calculateTradeAmount for BUY type", () => {
    const quantity = 10
    const price = 100
    const tax = 5
    const fees = 2
    const type = "BUY"

    const result = calculateTradeAmount(quantity, price, tax, fees, type)
    expect(result).toBe(1007)
  })

  test("calculateTradeAmount for SELL type", () => {
    const quantity = 10
    const price = 100
    const tax = 5
    const fees = 2
    const type = "SELL"

    const result = calculateTradeAmount(quantity, price, tax, fees, type)
    expect(result).toBe(993)
  })

  test("calculateTradeAmount with zero values", () => {
    const quantity = 0
    const price = 0
    const tax = 0
    const fees = 0
    const type = "BUY"

    const result = calculateTradeAmount(quantity, price, tax, fees, type)
    expect(result).toBe(0)
  })

  test("calculateCashAmount for SELL type", () => {
    const data: TradeFormData = {
      type: { value: "SELL", label: "Sell" },
      asset: "Asset1",
      market: "Market1",
      tradeDate: "2023-01-01",
      quantity: 10,
      price: 100,
      tradeCurrency: { value: "USD", label: "USD" },
      cashAmount: 1000,
      fees: 2,
      tax: 5,
      comments: undefined,
    }
    const result = calculateCashAmount(data)
    expect(result).toBe(1000)
  })

  test("SELL with cash incorrectly signed", () => {
    const data: TradeFormData = {
      type: { value: "SELL", label: "Sell" },
      asset: "Asset1",
      market: "Market1",
      tradeDate: "2023-01-01",
      quantity: 10,
      price: 100,
      tradeCurrency: { value: "USD", label: "USD" },
      cashAmount: -1000,
      fees: 2,
      tax: 5,
      comments: undefined,
    }
    const result = calculateCashAmount(data)
    expect(result).toBe(1000)
  })

  test("calculateCashAmount for BUY with positive cash", () => {
    const data: TradeFormData = {
      type: { value: "BUY", label: "Buy" },
      asset: "Asset1",
      market: "Market1",
      tradeDate: "2023-01-01",
      quantity: 10,
      price: 100,
      tradeCurrency: { value: "USD", label: "USD" },
      cashAmount: 550,
      fees: 2,
      tax: 5,
      comments: undefined,
    }
    const result = convertToTradeImport(data)
    expect(result.cashAmount).toBe(-550)
  })

  test("calculateCashAmount for BUY with negative cash", () => {
    const data: TradeFormData = {
      type: { value: "BUY", label: "Buy" },
      asset: "Asset1",
      market: "Market1",
      tradeDate: "2023-01-01",
      quantity: 10,
      price: 100,
      tradeCurrency: { value: "USD", label: "USD" },
      cashAmount: -550,
      fees: 2,
      tax: 5,
      comments: undefined,
    }
    const result = convertToTradeImport(data)
    expect(result.cashAmount).toBe(-550)
  })

  test("Splits do not impact cash.", () => {
    const data: TradeFormData = {
      type: { value: "SPLIT", label: "Split" },
      asset: "Asset1",
      market: "Market1",
      tradeDate: "2023-01-01",
      quantity: 10,
      price: 100,
      tradeCurrency: { value: "USD", label: "USD" },
      cashAmount: -550,
      fees: 2,
      tax: 5,
      comments: undefined,
    }
    const result = calculateCashAmount(data)
    expect(result).toBe(0)
  })

  test("calculateCashAmount for WITHDRAWAL with positive cash", () => {
    const data: TradeFormData = {
      type: { value: "WITHDRAWAL", label: "Withdrawal" },
      asset: "Asset1",
      market: "Market1",
      tradeDate: "2023-01-01",
      quantity: 10,
      price: 100,
      tradeCurrency: { value: "USD", label: "USD" },
      cashAmount: 1000,
      fees: 2,
      tax: 5,
      comments: undefined,
    }
    const result = calculateCashAmount(data)
    expect(result).toBe(-1000)
  })

  test("calculateCashAmount for WITHDRAWAL with negative cash", () => {
    const data: TradeFormData = {
      type: { value: "WITHDRAWAL", label: "Withdrawal" },
      asset: "Asset1",
      market: "Market1",
      tradeDate: "2023-01-01",
      quantity: 10,
      price: 100,
      tradeCurrency: { value: "USD", label: "USD" },
      cashAmount: -1000,
      fees: 2,
      tax: 5,
      comments: undefined,
    }
    const result = calculateCashAmount(data)
    expect(result).toBe(-1000)
  })

  test("convertToTradeImport", () => {
    const data: TradeFormData = {
      type: { value: "BUY", label: "Buy" },
      asset: "Asset1",
      market: "Market1",
      tradeDate: "2023-01-01",
      quantity: 10,
      price: 100,
      tradeCurrency: { value: "USD", label: "USD" },
      cashAmount: 550,
      fees: 2,
      tax: 5,
      comments: "Test comment",
    }
    const result = convertToTradeImport(data)
    expect(result).toEqual({
      batchId: expect.any(String),
      type: "BUY",
      market: "Market1",
      asset: "Asset1",
      cashAccount: "", // No settlement account specified
      cashCurrency: "USD", // Default to trade currency
      tradeDate: "2023-01-01",
      quantity: 10,
      tradeCurrency: "USD",
      price: 100,
      fees: 2,
      cashAmount: -550,
      comments: "Test comment",
      status: "SETTLED", // Default status
      brokerId: "", // No broker specified
    })
  })

  test("getTradeRow", () => {
    const data: TradeFormData = {
      type: { value: "BUY", label: "Buy" },
      asset: "Asset1",
      market: "Market1",
      tradeDate: "2023-01-01",
      quantity: 10,
      price: 100,
      tradeCurrency: { value: "USD", label: "USD" },
      cashAmount: 550,
      fees: 2,
      tax: 5,
      comments: "Test comment",
    }
    const result = getTradeRow(data)
    const batchId = generateBatchId(new Date())
    expect(result).toContain(
      `${batchId},,BUY,Market1,Asset1,,,USD,2023-01-01,10,,USD,100,2,,,-550,Test comment`,
    )
  })

  test("getCashRow", () => {
    const data: TradeFormData = {
      type: { value: "WITHDRAWAL", label: "Withdrawal" },
      market: "CASH",
      cashCurrency: { value: "USD", label: "USD" },
      tradeDate: "2023-01-01",
      quantity: 1000,
      price: 100,
      tradeCurrency: { value: "USD", label: "USD" },
      cashAmount: 1000,
      fees: 2,
      tax: 5,
      comments: "Test comment",
      asset: "",
    }
    const result = getCashRow(data)
    const batchId = generateBatchId(new Date())
    expect(result).toContain(
      `${batchId},,WITHDRAWAL,CASH,USD,,,USD,2023-01-01,-1000,,USD,100,2,,,-1000,Test comment`,
    )
  })

  test("convert function for trade", () => {
    const data: TradeFormData = {
      type: { value: "BUY", label: "Buy" },
      asset: "Asset1",
      market: "Market1",
      tradeDate: "2023-01-01",
      quantity: 10,
      price: 100,
      tradeCurrency: { value: "USD", label: "USD" },
      cashAmount: 550,
      fees: 2,
      tax: 5,
      comments: "Test comment",
    }
    const result = convert(data)
    expect(result).toContain(
      "BUY,Market1,Asset1,,,USD,2023-01-01,10,,USD,100,2,,,-550,Test comment",
    )
  })

  test("convert function for cash", () => {
    const data: TradeFormData = {
      type: { value: "WITHDRAWAL", label: "Withdrawal" },
      market: "CASH",
      tradeDate: "2023-01-01",
      quantity: 1000,
      price: 100,
      tradeCurrency: { value: "SGD", label: "SGD" },
      cashCurrency: { value: "SGD", label: "SGD" },
      cashAmount: 1000,
      fees: 2,
      tax: 5,
      comments: "Test comment",
      asset: "",
    }
    const result = convert(data)
    const batchId = generateBatchId(new Date())
    expect(result).toContain(
      `${batchId},,WITHDRAWAL,CASH,SGD,,,SGD,2023-01-01,-1000,,SGD,100,2,,,-1000,Test comment`,
    )
  })

  test("FX trade from currency to bank account uses correct format", () => {
    // Selling from a generic currency balance (CASH market) into a bank account
    const data: TradeFormData = {
      type: { value: "FX", label: "FX" },
      asset: "SGD", // Sell from SGD cash balance
      market: "CASH",
      tradeDate: "2023-01-21",
      quantity: 5958.77, // Sell amount in SGD
      price: 1,
      tradeCurrency: {
        value: "SGD",
        label: "SGD",
        currency: "SGD",
        market: "CASH", // Selling from generic cash balance
      },
      cashCurrency: {
        value: "SCB-USD", // Buy into SCB-USD bank account
        label: "SCB USD Account (USD)",
        currency: "USD",
        market: "PRIVATE",
      },
      cashAmount: 4600, // Buy amount in USD
      fees: 0,
      tax: 0,
      comments: undefined,
    }
    const result = getCashRow(data)

    // CSV should contain:
    // - Code: SCB-USD (the buy asset code)
    // - CashAccount: empty (selling from generic cash balance)
    // - CashCurrency: SGD (the sell currency)
    // - TradeCurrency: USD (the buy currency)
    expect(result).toContain("FX_BUY")
    expect(result).toContain(",SCB-USD,,") // Code field, then empty CashAccount
    expect(result).toContain(",SGD,") // CashCurrency field (sell currency)
    expect(result).toContain(",,USD,1,") // TradeCurrency field
    expect(result).toContain("Buy USD/Sell SGD")
  })

  test("FX trade between two bank accounts includes sell asset CODE in CashAccount", () => {
    // Selling from SCB-SGD bank account into SCB-USD bank account
    // The form sets market="PRIVATE" when a bank account is selected as sell asset
    // The asset field contains the sell asset code (e.g., "SCB-SGD")
    const data: TradeFormData = {
      type: { value: "FX", label: "FX" },
      asset: "SCB-SGD", // Sell from SCB-SGD bank account (code)
      market: "PRIVATE", // This tells us we're selling from a bank account
      tradeDate: "2023-01-21",
      quantity: 5958.77, // Sell amount
      price: 1,
      tradeCurrency: {
        value: "SGD", // The currency (form sets this to the currency, not asset code)
        label: "SGD",
      },
      cashCurrency: {
        value: "SCB-USD", // Buy into SCB-USD bank account
        label: "SCB USD Account (USD)",
        currency: "USD",
        market: "PRIVATE",
      },
      cashAmount: 4600, // Buy amount in USD
      fees: 0,
      tax: 0,
      comments: undefined,
    }
    const result = getCashRow(data)

    // CSV should contain:
    // - Code: SCB-USD (the buy asset code)
    // - CashAccount: SCB-SGD (the sell asset CODE for backend lookup)
    // - CashCurrency: SGD (the sell currency)
    // - TradeCurrency: USD (the buy currency)
    expect(result).toContain("FX_BUY")
    expect(result).toContain(",SCB-USD,") // Code field (buy asset)
    expect(result).toContain(",SCB-SGD,SGD,") // CashAccount=code, CashCurrency=SGD
    expect(result).toContain(",,USD,1,") // TradeCurrency field
    expect(result).toContain("Buy USD/Sell SGD") // Comment uses currencies
  })

  test("FX buy into generic cash balance uses BUY market in Market column", () => {
    // Sell from DBS-SGD bank account (PRIVATE) → buy generic USD cash balance (CASH).
    // The Market column describes the BUY asset, so it must be CASH (the buy side),
    // NOT PRIVATE (the sell side). Using the sell market resolved a phantom
    // PRIVATE/USD asset and no USD balance ever appeared.
    const data: TradeFormData = {
      type: { value: "FX", label: "FX" },
      asset: "DBS-SGD", // Sell from DBS-SGD bank account
      market: "PRIVATE", // Sell side market
      tradeDate: "2023-01-21",
      quantity: 5958.77, // Sell amount in SGD
      price: 1,
      tradeCurrency: {
        value: "SGD",
        label: "SGD",
        currency: "SGD",
        market: "PRIVATE",
      },
      cashCurrency: {
        value: "USD", // Buy generic USD cash balance
        label: "USD",
        currency: "USD",
        market: "CASH", // Buy side market — belongs in the Market column
      },
      cashAmount: 4600, // Buy amount in USD
      fees: 0,
      tax: 0,
      comments: undefined,
    }
    const result = getCashRow(data)

    // Market=CASH (buy side), Code=USD, CashAccount=DBS-SGD (sell), CashCurrency=SGD
    expect(result).toContain("FX_BUY,CASH,USD,,DBS-SGD,SGD,")
    expect(result).toContain("Buy USD/Sell SGD")
  })

  test("FX buy with no buy-side market falls back to CASH, not the sell market", () => {
    // User leaves the default Buy Currency (no market set) and sells from a
    // PRIVATE bank account. The buy side must still resolve to a CASH balance —
    // falling back to the sell market produced a phantom PRIVATE/USD equity
    // asset and no USD balance appeared.
    const data: TradeFormData = {
      type: { value: "FX", label: "FX" },
      asset: "DBS-SGD",
      market: "PRIVATE", // Sell side market
      tradeDate: "2026-06-27",
      quantity: 5000, // Sell SGD
      price: 1,
      tradeCurrency: {
        value: "SGD",
        label: "SGD",
        currency: "SGD",
        market: "PRIVATE",
      },
      cashCurrency: {
        value: "USD", // Default buy option — note: NO market field
        label: "USD",
        currency: "USD",
      },
      cashAmount: 3863.39, // Buy USD
      fees: 0,
      tax: 0,
      comments: undefined,
    }
    const result = getCashRow(data)

    // Must be CASH, not the sell side's PRIVATE.
    expect(result).toContain("FX_BUY,CASH,USD,,DBS-SGD,SGD,")
  })

  test("tradeCurrency defaults to cashCurrency if missing", () => {
    const data: TradeFormData = {
      type: { value: "DIVI", label: "Dividend" },
      asset: "Asset1",
      market: "Market1",
      tradeDate: "2023-01-01",
      quantity: 10,
      price: 1,
      cashCurrency: { value: "USD", label: "USD" },
      cashAmount: 10,
      fees: 0,
      tax: 0,
      comments: undefined,
      tradeCurrency: {
        value: "",
        label: "",
      },
    }
    const result = convertToTradeImport(data)
    expect(result.tradeCurrency).toBe("USD")
    expect(result.cashCurrency).toBe("USD")
  })

  describe("calculateTradeWeight", () => {
    test("calculates weight for BUY trade - 1k trade on 10k portfolio = 10%", () => {
      const tradeAmount = 1000
      const portfolioValue = 10000
      const result = calculateTradeWeight(tradeAmount, portfolioValue)
      expect(result).toBe(10)
    })

    test("calculates weight for larger trade", () => {
      const tradeAmount = 5000
      const portfolioValue = 10000
      const result = calculateTradeWeight(tradeAmount, portfolioValue)
      expect(result).toBe(50)
    })

    test("handles negative trade amounts (SELL)", () => {
      const tradeAmount = -1000
      const portfolioValue = 10000
      const result = calculateTradeWeight(tradeAmount, portfolioValue)
      expect(result).toBe(10) // Should use absolute value
    })

    test("returns 0 for zero portfolio value", () => {
      const tradeAmount = 1000
      const portfolioValue = 0
      const result = calculateTradeWeight(tradeAmount, portfolioValue)
      expect(result).toBe(0)
    })

    test("returns 0 for negative portfolio value", () => {
      const tradeAmount = 1000
      const portfolioValue = -10000
      const result = calculateTradeWeight(tradeAmount, portfolioValue)
      expect(result).toBe(0)
    })
  })

  describe("calculateNewPositionWeight", () => {
    test("selling 50% of 10% position results in ~5% weight", () => {
      // Portfolio = 10k, position = 1k (10%), selling half
      const initialQuantity = 100
      const sellQuantity = 50
      const price = 10 // position value = 100 * 10 = 1000
      const portfolioValue = 10000

      const result = calculateNewPositionWeight(
        initialQuantity,
        sellQuantity,
        price,
        portfolioValue,
      )
      expect(result).toBe(5) // 50 * 10 / 10000 = 5%
    })

    test("selling entire position results in 0% weight", () => {
      const initialQuantity = 100
      const sellQuantity = 100
      const price = 10
      const portfolioValue = 10000

      const result = calculateNewPositionWeight(
        initialQuantity,
        sellQuantity,
        price,
        portfolioValue,
      )
      expect(result).toBe(0)
    })

    test("selling more than held results in 0% weight", () => {
      const initialQuantity = 100
      const sellQuantity = 150 // More than held
      const price = 10
      const portfolioValue = 10000

      const result = calculateNewPositionWeight(
        initialQuantity,
        sellQuantity,
        price,
        portfolioValue,
      )
      expect(result).toBe(0)
    })

    test("returns 0 for zero portfolio value", () => {
      const result = calculateNewPositionWeight(100, 50, 10, 0)
      expect(result).toBe(0)
    })

    test("returns 0 for zero initial quantity", () => {
      const result = calculateNewPositionWeight(0, 50, 10, 10000)
      expect(result).toBe(0)
    })

    test("selling 25% of position", () => {
      // 20% position, selling 25% of it
      const initialQuantity = 200
      const sellQuantity = 50 // 25% of 200
      const price = 10 // position = 2000 (20% of 10k)
      const portfolioValue = 10000

      const result = calculateNewPositionWeight(
        initialQuantity,
        sellQuantity,
        price,
        portfolioValue,
      )
      expect(result).toBe(15) // 150 * 10 / 10000 = 15%
    })
  })

  describe("EXPENSE transactions", () => {
    test("calculateCashAmount returns negative tradeAmount for EXPENSE", () => {
      const data: TradeFormData = {
        type: { value: "EXPENSE", label: "Expense" },
        asset: "APT",
        market: "PRIVATE",
        tradeDate: "2024-01-15",
        quantity: 0,
        price: 0,
        tradeCurrency: { value: "NZD", label: "NZD" },
        tradeAmount: 500,
        cashAmount: 0,
        fees: 0,
        tax: 0,
        comments: "Insurance",
      }
      expect(calculateCashAmount(data)).toBe(-500)
    })

    test("convertToTradeImport sets quantity=1 and price=tradeAmount for EXPENSE", () => {
      const data: TradeFormData = {
        type: { value: "EXPENSE", label: "Expense" },
        asset: "APT",
        market: "PRIVATE",
        tradeDate: "2024-01-15",
        quantity: 0,
        price: 0,
        tradeCurrency: { value: "NZD", label: "NZD" },
        tradeAmount: 500,
        cashAmount: 0,
        fees: 0,
        tax: 0,
        comments: "Insurance",
        settlementAccount: {
          value: "kiwi-bank-id",
          label: "KIWI Bank",
          currency: "NZD",
        },
      }
      const result = convertToTradeImport(data)
      expect(result.quantity).toBe(1)
      expect(result.price).toBe(500)
      expect(result.cashAmount).toBe(-500)
      expect(result.cashAccount).toBe("kiwi-bank-id")
      expect(result.cashCurrency).toBe("NZD")
    })

    test("EXPENSE CSV row contains correct values", () => {
      const data: TradeFormData = {
        type: { value: "EXPENSE", label: "Expense" },
        asset: "APT",
        market: "PRIVATE",
        tradeDate: "2024-01-15",
        quantity: 0,
        price: 0,
        tradeCurrency: { value: "NZD", label: "NZD" },
        tradeAmount: 500,
        cashAmount: 0,
        fees: 0,
        tax: 0,
        comments: "Insurance",
        settlementAccount: {
          value: "kiwi-bank-id",
          label: "KIWI Bank",
          currency: "NZD",
        },
      }
      const row = getTradeRow(data)
      expect(row).toContain(
        "EXPENSE,PRIVATE,APT,,kiwi-bank-id,NZD,2024-01-15,1,,NZD,500,0,,,-500,Insurance",
      )
    })
  })

  describe("hasCashImpact", () => {
    test("returns false for ADD", () => {
      expect(hasCashImpact("ADD")).toBe(false)
    })

    test("returns false for REDUCE", () => {
      expect(hasCashImpact("REDUCE")).toBe(false)
    })

    test("returns false for SPLIT", () => {
      expect(hasCashImpact("SPLIT")).toBe(false)
    })

    test("returns true for BUY", () => {
      expect(hasCashImpact("BUY")).toBe(true)
    })

    test("returns true for SELL", () => {
      expect(hasCashImpact("SELL")).toBe(true)
    })

    test("returns true for DIVI", () => {
      expect(hasCashImpact("DIVI")).toBe(true)
    })

    test("returns true for EXPENSE", () => {
      expect(hasCashImpact("EXPENSE")).toBe(true)
    })
  })

  describe("isExpenseType", () => {
    test("returns true for EXPENSE", () => {
      expect(isExpenseType("EXPENSE")).toBe(true)
    })

    test("returns false for BUY", () => {
      expect(isExpenseType("BUY")).toBe(false)
    })

    test("returns false for SELL", () => {
      expect(isExpenseType("SELL")).toBe(false)
    })
  })

  describe("getAssetCurrency", () => {
    test("returns code for CASH market assets", () => {
      expect(
        getAssetCurrency({
          code: "USD",
          market: { code: "CASH" },
        }),
      ).toBe("USD")
    })

    test("returns priceSymbol when available for non-CASH assets", () => {
      expect(
        getAssetCurrency({
          code: "AAPL",
          priceSymbol: "USD",
          market: { code: "NASDAQ", currency: { code: "USD" } },
        }),
      ).toBe("USD")
    })

    test("falls back to market currency when priceSymbol is absent", () => {
      expect(
        getAssetCurrency({
          code: "AAPL",
          market: { code: "NASDAQ", currency: { code: "USD" } },
        }),
      ).toBe("USD")
    })

    test("returns accountingType currency when available", () => {
      expect(
        getAssetCurrency({
          code: "148_OBRVTziEJUdnLKsSlA.SCB-USD",
          accountingType: { currency: { code: "USD" } },
          priceSymbol: "SGD",
          market: { code: "PRIVATE", currency: { code: "SGD" } },
        }),
      ).toBe("USD")
    })

    test("returns empty string when no currency info available", () => {
      expect(
        getAssetCurrency({
          code: "UNKNOWN",
          market: { code: "OTHER" },
        }),
      ).toBe("")
    })
  })

  describe("deriveDefaultMarket", () => {
    const markets = [
      { code: "US", currency: { code: "USD" } },
      { code: "NZX", currency: { code: "NZD" } },
      { code: "ASX", currency: { code: "AUD" } },
    ]

    test("finds market matching currency code", () => {
      expect(deriveDefaultMarket("NZD", markets)).toBe("NZX")
    })

    test("finds US market for USD", () => {
      expect(deriveDefaultMarket("USD", markets)).toBe("US")
    })

    test("returns 'US' as fallback when no market matches", () => {
      expect(deriveDefaultMarket("GBP", markets)).toBe("US")
    })

    test("returns 'US' for empty markets array", () => {
      expect(deriveDefaultMarket("NZD", [])).toBe("US")
    })

    test("uses custom fallback when no market matches", () => {
      expect(deriveDefaultMarket("GBP", markets, "NZX")).toBe("NZX")
    })

    test("ignores fallback when a market matches", () => {
      expect(deriveDefaultMarket("NZD", markets, "ASX")).toBe("NZX")
    })
  })

  describe("isBuySide", () => {
    test.each(["BUY", "ADD", "DIVI", "INCOME"])("%s is buy side", (type) => {
      expect(isBuySide(type)).toBe(true)
    })

    test.each(["SELL", "REDUCE", "EXPENSE", "SPLIT"])(
      "%s is not buy side",
      (type) => {
        expect(isBuySide(type)).toBe(false)
      },
    )
  })

  describe("isSellSide", () => {
    test.each(["SELL", "REDUCE", "EXPENSE"])("%s is sell side", (type) => {
      expect(isSellSide(type)).toBe(true)
    })

    test.each(["BUY", "ADD", "DIVI", "INCOME", "SPLIT"])(
      "%s is not sell side",
      (type) => {
        expect(isSellSide(type)).toBe(false)
      },
    )
  })

  describe("isPositionAdjustment", () => {
    test.each(["ADD", "REDUCE"])("%s is a position adjustment", (type) => {
      expect(isPositionAdjustment(type)).toBe(true)
    })

    test.each(["BUY", "SELL", "EXPENSE", "INCOME", "DIVI", "SPLIT"])(
      "%s is not a position adjustment",
      (type) => {
        expect(isPositionAdjustment(type)).toBe(false)
      },
    )
  })

  describe("getTradeColorScheme", () => {
    test("returns emerald for BUY", () => {
      const scheme = getTradeColorScheme("BUY")
      expect(scheme.bg).toContain("emerald")
      expect(scheme.text).toContain("emerald")
    })

    test("returns red for SELL", () => {
      const scheme = getTradeColorScheme("SELL")
      expect(scheme.bg).toContain("red")
      expect(scheme.text).toContain("red")
    })

    test("returns red for EXPENSE", () => {
      const scheme = getTradeColorScheme("EXPENSE")
      expect(scheme.bg).toContain("red")
    })

    test("returns blue for ADD (position adjustment)", () => {
      const scheme = getTradeColorScheme("ADD")
      expect(scheme.bg).toContain("blue")
      expect(scheme.text).toContain("blue")
    })

    test("returns blue for REDUCE (position adjustment)", () => {
      const scheme = getTradeColorScheme("REDUCE")
      expect(scheme.bg).toContain("blue")
    })

    test("returns emerald for DIVI", () => {
      const scheme = getTradeColorScheme("DIVI")
      expect(scheme.bg).toContain("emerald")
    })
  })

  describe("getQtyPriceTint", () => {
    test("returns emerald tint for BUY", () => {
      expect(getQtyPriceTint("BUY")).toContain("emerald")
    })

    test("returns red tint for SELL", () => {
      expect(getQtyPriceTint("SELL")).toContain("red")
    })

    test("returns emerald tint for ADD (buy side)", () => {
      expect(getQtyPriceTint("ADD")).toContain("emerald")
    })

    test("returns red tint for REDUCE (sell side)", () => {
      expect(getQtyPriceTint("REDUCE")).toContain("red")
    })

    test("returns empty string for unknown type", () => {
      expect(getQtyPriceTint("SPLIT")).toBe("")
    })
  })

  describe("owner prefix stripping", () => {
    test("strips owner prefix from private asset code", () => {
      const data: TradeFormData = {
        type: { value: "BUY", label: "Buy" },
        asset: "148_OBRVTziEJUdnLKsSlA.APT",
        market: "PRIVATE",
        tradeDate: "2024-01-15",
        quantity: 1,
        price: 100,
        tradeCurrency: { value: "NZD", label: "NZD" },
        cashAmount: 100,
        fees: 0,
        tax: 0,
        comments: undefined,
      }
      const result = convertToTradeImport(data)
      expect(result.asset).toBe("APT")
    })

    test("leaves normal asset codes unchanged", () => {
      const data: TradeFormData = {
        type: { value: "BUY", label: "Buy" },
        asset: "AAPL",
        market: "NASDAQ",
        tradeDate: "2024-01-15",
        quantity: 10,
        price: 150,
        tradeCurrency: { value: "USD", label: "USD" },
        cashAmount: 1500,
        fees: 0,
        tax: 0,
        comments: undefined,
      }
      const result = convertToTradeImport(data)
      expect(result.asset).toBe("AAPL")
    })
  })

  describe("private cash account settlement", () => {
    test("INCOME on PRIVATE account settles to same account", () => {
      const data: TradeFormData = {
        type: { value: "INCOME", label: "INCOME" },
        asset: "SGD-SAVINGS",
        market: "PRIVATE",
        tradeDate: "2025-01-15",
        quantity: 150,
        price: 1,
        tradeAmount: 150,
        tradeCurrency: { value: "SGD", label: "SGD" },
        cashCurrency: { value: "SGD", label: "SGD" },
        cashAmount: 150,
        fees: 0,
        tax: 0,
        comments: "Interest",
      }
      const result = convertToTradeImport(data)
      expect(result.cashAccount).toBe("SGD-SAVINGS")
    })

    test("DEPOSIT on PRIVATE account settles to same account", () => {
      const data: TradeFormData = {
        type: { value: "DEPOSIT", label: "DEPOSIT" },
        asset: "SGD-SAVINGS",
        market: "PRIVATE",
        tradeDate: "2025-01-15",
        quantity: 1000,
        price: 1,
        tradeCurrency: { value: "SGD", label: "SGD" },
        cashCurrency: { value: "SGD", label: "SGD" },
        cashAmount: 1000,
        fees: 0,
        tax: 0,
        comments: undefined,
      }
      const result = convertToTradeImport(data)
      expect(result.cashAccount).toBe("SGD-SAVINGS")
    })

    test("DEPOSIT on CASH market does not set cashAccount", () => {
      const data: TradeFormData = {
        type: { value: "DEPOSIT", label: "DEPOSIT" },
        asset: "SGD",
        market: "CASH",
        tradeDate: "2025-01-15",
        quantity: 1000,
        price: 1,
        tradeCurrency: { value: "SGD", label: "SGD" },
        cashCurrency: { value: "SGD", label: "SGD" },
        cashAmount: 1000,
        fees: 0,
        tax: 0,
        comments: undefined,
      }
      const result = convertToTradeImport(data)
      expect(result.cashAccount).toBe("")
    })

    test("explicit settlementAccount takes precedence over PRIVATE market", () => {
      const data: TradeFormData = {
        type: { value: "BUY", label: "BUY" },
        asset: "AAPL",
        market: "PRIVATE",
        tradeDate: "2025-01-15",
        quantity: 10,
        price: 150,
        tradeCurrency: { value: "USD", label: "USD" },
        cashCurrency: { value: "USD", label: "USD" },
        cashAmount: 1500,
        fees: 0,
        tax: 0,
        comments: undefined,
        settlementAccount: {
          value: "MY-USD-ACCOUNT",
          label: "My Account",
          currency: "USD",
        },
      }
      const result = convertToTradeImport(data)
      expect(result.cashAccount).toBe("MY-USD-ACCOUNT")
    })
  })
})

describe("computeTradeGroupTotals", () => {
  const trn = (over: Partial<Transaction>): Transaction =>
    ({
      trnType: "BUY",
      tradeDate: "2025-01-01",
      quantity: 0,
      tradeAmount: 0,
      cashAmount: 0,
      fees: 0,
      tax: 0,
      ...over,
    }) as Transaction

  test("sums quantity when no BALANCE present", () => {
    const totals = computeTradeGroupTotals([
      trn({ tradeDate: "2025-01-01", quantity: 10 }),
      trn({ tradeDate: "2025-02-01", quantity: 5 }),
    ])
    expect(totals.quantity).toBe(15)
  })

  test("resets running quantity to the BALANCE quantity", () => {
    const totals = computeTradeGroupTotals([
      trn({ tradeDate: "2025-01-01", quantity: 10 }),
      trn({ tradeDate: "2025-02-01", quantity: 7 }),
      trn({ trnType: "BALANCE", tradeDate: "2025-03-01", quantity: 100 }),
    ])
    expect(totals.quantity).toBe(100)
  })

  test("accumulates trades dated after the BALANCE on top of it", () => {
    const totals = computeTradeGroupTotals([
      trn({ tradeDate: "2025-01-01", quantity: 10 }),
      trn({ trnType: "BALANCE", tradeDate: "2025-02-01", quantity: 100 }),
      trn({ tradeDate: "2025-03-01", quantity: 5 }),
    ])
    expect(totals.quantity).toBe(105)
  })

  test("is order-independent (input arrives newest-first)", () => {
    const totals = computeTradeGroupTotals([
      trn({ tradeDate: "2025-03-01", quantity: 5 }),
      trn({ trnType: "BALANCE", tradeDate: "2025-02-01", quantity: 100 }),
      trn({ tradeDate: "2025-01-01", quantity: 10 }),
    ])
    expect(totals.quantity).toBe(105)
  })

  test("BALANCE wins over a same-date trade regardless of input order", () => {
    const trade = trn({ tradeDate: "2025-02-01", quantity: 7 })
    const balance = trn({
      trnType: "BALANCE",
      tradeDate: "2025-02-01",
      quantity: 100,
    })
    expect(computeTradeGroupTotals([trade, balance]).quantity).toBe(100)
    expect(computeTradeGroupTotals([balance, trade]).quantity).toBe(100)
  })

  test("the latest BALANCE wins when several exist", () => {
    const totals = computeTradeGroupTotals([
      trn({ trnType: "BALANCE", tradeDate: "2025-01-01", quantity: 50 }),
      trn({ tradeDate: "2025-02-01", quantity: 5 }),
      trn({ trnType: "BALANCE", tradeDate: "2025-03-01", quantity: 200 }),
    ])
    expect(totals.quantity).toBe(200)
  })

  test("still sums cash-side totals across the group", () => {
    const totals = computeTradeGroupTotals([
      trn({
        tradeDate: "2025-01-01",
        tradeAmount: 1000,
        cashAmount: -1000,
        fees: 2,
        tax: 1,
      }),
      trn({ trnType: "BALANCE", tradeDate: "2025-02-01", quantity: 100 }),
      trn({
        tradeDate: "2025-03-01",
        tradeAmount: 500,
        cashAmount: -500,
        fees: 3,
        tax: 4,
      }),
    ])
    expect(totals.tradeAmount).toBe(1500)
    expect(totals.cashAmount).toBe(-1500)
    expect(totals.fees).toBe(5)
    expect(totals.tax).toBe(5)
  })

  test("adds a same-date ADD on top of the BALANCE (CPF contribution)", () => {
    const totals = computeTradeGroupTotals([
      // Newest-first, as the endpoint returns them
      trn({
        trnType: "ADD",
        tradeDate: "2026-06-17",
        quantity: 2877.49,
        tradeAmount: 2877.49,
      }),
      trn({
        trnType: "BALANCE",
        tradeDate: "2026-06-17",
        quantity: 185900,
        tradeAmount: 185900,
      }),
      trn({
        trnType: "BALANCE",
        tradeDate: "2026-06-14",
        quantity: 281000,
        tradeAmount: 281000,
      }),
    ])
    // BALANCE resets to 185,900, then the same-date ADD accumulates on top.
    expect(totals.quantity).toBeCloseTo(188777.49)
    // A value-bearing BALANCE resets the amount too — snapshots are not summed.
    expect(totals.tradeAmount).toBeCloseTo(188777.49)
  })

  test("a value-bearing same-date BALANCE still overrides a regular BUY", () => {
    const buy = trn({
      trnType: "BUY",
      tradeDate: "2025-02-01",
      quantity: 7,
      tradeAmount: 700,
    })
    const balance = trn({
      trnType: "BALANCE",
      tradeDate: "2025-02-01",
      quantity: 100,
      tradeAmount: 100,
    })
    for (const input of [
      [buy, balance],
      [balance, buy],
    ]) {
      const totals = computeTradeGroupTotals(input)
      expect(totals.quantity).toBe(100)
      expect(totals.tradeAmount).toBe(100)
    }
  })
})

describe("buildTradeGroups", () => {
  const dbsPf = { id: "p1", code: "DBS" }
  const dbs = { id: "b-dbs", name: "DBS" }
  const scb = { id: "b-scb", name: "SCB" }

  const trn = (over: Partial<Transaction>): Transaction =>
    ({
      trnType: "BUY",
      tradeDate: "2025-01-01",
      quantity: 0,
      tradeAmount: 0,
      cashAmount: 0,
      fees: 0,
      tax: 0,
      portfolio: dbsPf,
      ...over,
    }) as Transaction

  // The reported bug: SCHD bought 175 via DBS and 80 via SCB, both in the
  // "DBS"-coded portfolio. The aggregate drill-down must split the two brokers
  // out instead of collapsing the 80 under the portfolio named "DBS".
  test("aggregated view splits one portfolio into its brokers", () => {
    const summary: TrnTradeSummary = {
      groupBy: "PORTFOLIO",
      groups: [
        {
          groupId: "p1",
          quantity: 255,
          subTotals: [
            { groupId: "b-dbs", quantity: 175 },
            { groupId: "b-scb", quantity: 80 },
          ],
        },
      ],
    }
    const groups = buildTradeGroups(
      [
        trn({ id: "t1", quantity: 175, broker: dbs }),
        trn({ id: "t2", quantity: 80, broker: scb, tradeDate: "2025-12-03" }),
      ],
      true,
      summary,
    )

    expect(groups).toHaveLength(2)
    const dbsGroup = groups.find((g) => g.label === "DBS")!
    const scbGroup = groups.find((g) => g.label === "SCB")!
    expect(dbsGroup.portfolioCode).toBe("DBS")
    expect(scbGroup.portfolioCode).toBe("DBS")
    // Server-authoritative split-adjusted quantity per broker, not the naive sum.
    expect(dbsGroup.totals.quantity).toBe(175)
    expect(scbGroup.totals.quantity).toBe(80)
    // Both brokers, and the 80 is no longer hidden under the portfolio total.
    expect(scbGroup.transactions.map((t) => t.id)).toEqual(["t2"])
  })

  test("single-portfolio view still groups by broker only", () => {
    const summary: TrnTradeSummary = {
      groupBy: "BROKER",
      groups: [
        { groupId: "b-dbs", quantity: 175 },
        { groupId: "b-scb", quantity: 80 },
      ],
    }
    const groups = buildTradeGroups(
      [
        trn({ id: "t1", quantity: 175, broker: dbs }),
        trn({ id: "t2", quantity: 80, broker: scb }),
      ],
      false,
      summary,
    )

    expect(groups.map((g) => g.label).sort()).toEqual(["DBS", "SCB"])
    expect(groups.every((g) => g.portfolioCode === undefined)).toBe(true)
    expect(groups.find((g) => g.label === "SCB")!.totals.quantity).toBe(80)
  })

  test("no-broker trns fall into a 'No Broker' group sorted last", () => {
    const summary: TrnTradeSummary = {
      groupBy: "PORTFOLIO",
      groups: [
        {
          groupId: "p1",
          quantity: 175,
          subTotals: [
            { groupId: "b-dbs", quantity: 175 },
            { groupId: "", quantity: 0 },
          ],
        },
      ],
    }
    const groups = buildTradeGroups(
      [
        trn({ id: "t1", quantity: 175, broker: dbs }),
        trn({ id: "d1", trnType: "DIVI", quantity: 175 }),
      ],
      true,
      summary,
    )

    expect(groups.map((g) => g.label)).toEqual(["DBS", "No Broker"])
  })
})
