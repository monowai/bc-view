import {
  calculateCashAmount,
  calculateTradeAmount,
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
      cashCurrency: "USD", // Default to trade currency
      tradeDate: "2023-01-01",
      quantity: 10,
      tradeCurrency: "USD",
      price: 100,
      fees: 2,
      cashAmount: -550,
      comments: "Test comment",
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
})
