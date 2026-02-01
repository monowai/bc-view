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
} from "./tradeUtils"
import { TradeFormData } from "types/beancounter"

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

  describe("owner prefix stripping", () => {
    test("strips owner prefix from private asset code", () => {
      const data: TradeFormData = {
        type: { value: "BUY", label: "Buy" },
        asset: "userId123.APT",
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
})
