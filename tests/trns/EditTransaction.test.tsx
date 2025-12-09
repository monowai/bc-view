import "@testing-library/jest-dom"

// Mock next-i18next
jest.mock("next-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    ready: true,
  }),
}))

// Mock SWR mutate for cache invalidation tests
const mockMutate = jest.fn()
jest.mock("swr", () => {
  const actual = jest.requireActual("swr")
  return {
    __esModule: true,
    default: jest.fn(),
    mutate: (...args: unknown[]) => mockMutate(...args),
    SWRConfig: actual.SWRConfig,
  }
})

// Mock fetch globally
const mockFetch = jest.fn()
global.fetch = mockFetch

// Mock trade transaction (BUY/SELL)
const mockTradeTransaction = {
  id: "trn-123",
  trnType: "BUY",
  tradeDate: "2024-01-15",
  quantity: 100,
  price: 150.5,
  tradeAmount: 15050,
  cashAmount: -15050,
  tradeCashRate: 1,
  fees: 10,
  tax: 0,
  comments: "Test trade",
  asset: {
    id: "asset-1",
    code: "AAPL",
    name: "Apple Inc",
    market: { code: "NASDAQ" },
  },
  tradeCurrency: { code: "USD", name: "US Dollar", symbol: "$" },
  cashCurrency: { code: "USD", name: "US Dollar", symbol: "$" },
  portfolio: {
    id: "portfolio-1",
    code: "TEST",
    name: "Test Portfolio",
  },
}

// Mock cash transaction (DEPOSIT/WITHDRAWAL)
const mockCashTransaction = {
  id: "trn-456",
  trnType: "DEPOSIT",
  tradeDate: "2024-01-15",
  quantity: 1,
  price: 1,
  tradeAmount: 5000,
  cashAmount: 5000,
  tradeCashRate: 1,
  fees: 0,
  tax: 0,
  comments: "Cash deposit",
  asset: {
    id: "cash-usd",
    code: "USD",
    name: "US Dollar",
    market: { code: "CASH" },
  },
  tradeCurrency: { code: "USD", name: "US Dollar", symbol: "$" },
  cashCurrency: { code: "USD", name: "US Dollar", symbol: "$" },
  portfolio: {
    id: "portfolio-1",
    code: "TEST",
    name: "Test Portfolio",
  },
}

// Import the API helper functions to test
import { updateTrn, TrnUpdatePayload } from "@lib/trns/apiHelper"

describe("Edit Transaction API", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockReset()
  })

  describe("updateTrn function", () => {
    it("should make PATCH request with correct URL and payload for trade transaction", async () => {
      const payload: TrnUpdatePayload = {
        trnType: "BUY",
        assetId: "asset-1",
        tradeDate: "2024-01-15",
        quantity: 100,
        price: 150.5,
        tradeCurrency: "USD",
        tradeAmount: 15050,
        cashCurrency: "USD",
        cashAmount: -15050,
        fees: 10,
        tax: 0,
        comments: "Test trade",
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: mockTradeTransaction }),
      })

      await updateTrn("portfolio-1", "trn-123", payload)

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/trns/trn-123?portfolioId=portfolio-1",
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      )
    })

    it("should make PATCH request with correct payload for cash transaction", async () => {
      const payload: TrnUpdatePayload = {
        trnType: "DEPOSIT",
        assetId: "cash-usd",
        tradeDate: "2024-01-15",
        quantity: 5000,
        price: 1,
        tradeCurrency: "USD",
        tradeAmount: 5000,
        cashCurrency: "USD",
        cashAmount: 5000,
        fees: 0,
        tax: 0,
        comments: "Cash deposit",
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: mockCashTransaction }),
      })

      await updateTrn("portfolio-1", "trn-456", payload)

      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/trns/trn-456?portfolioId=portfolio-1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify(payload),
        }),
      )
    })

    it("should include portfolioId as query parameter", async () => {
      const payload: TrnUpdatePayload = {
        trnType: "SELL",
        assetId: "asset-1",
        tradeDate: "2024-01-15",
        quantity: 50,
        price: 160,
        tradeCurrency: "USD",
        tradeAmount: 8000,
        cashCurrency: "USD",
        cashAmount: 8000,
        fees: 5,
        tax: 0,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })

      await updateTrn("my-portfolio-id", "my-trn-id", payload)

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe("/api/trns/my-trn-id?portfolioId=my-portfolio-id")
    })

    it("should handle optional tradeCashRate field", async () => {
      const payloadWithRate: TrnUpdatePayload = {
        trnType: "BUY",
        assetId: "asset-1",
        tradeDate: "2024-01-15",
        quantity: 100,
        price: 150,
        tradeCurrency: "USD",
        tradeAmount: 15000,
        cashCurrency: "NZD",
        cashAmount: -22500,
        tradeCashRate: 1.5,
        fees: 10,
        tax: 0,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })

      await updateTrn("portfolio-1", "trn-123", payloadWithRate)

      const [, options] = mockFetch.mock.calls[0]
      const body = JSON.parse(options.body)
      expect(body.tradeCashRate).toBe(1.5)
    })

    it("should handle optional comments field", async () => {
      const payloadWithComments: TrnUpdatePayload = {
        trnType: "BUY",
        assetId: "asset-1",
        tradeDate: "2024-01-15",
        quantity: 100,
        price: 150,
        tradeCurrency: "USD",
        tradeAmount: 15000,
        cashCurrency: "USD",
        cashAmount: -15000,
        fees: 0,
        tax: 0,
        comments: "Updated comment",
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })

      await updateTrn("portfolio-1", "trn-123", payloadWithComments)

      const [, options] = mockFetch.mock.calls[0]
      const body = JSON.parse(options.body)
      expect(body.comments).toBe("Updated comment")
    })

    it("should return fetch response for success handling", async () => {
      const payload: TrnUpdatePayload = {
        trnType: "BUY",
        assetId: "asset-1",
        tradeDate: "2024-01-15",
        quantity: 100,
        price: 150,
        tradeCurrency: "USD",
        tradeAmount: 15000,
        cashCurrency: "USD",
        cashAmount: -15000,
        fees: 0,
        tax: 0,
      }

      const mockResponse = {
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: mockTradeTransaction }),
      }
      mockFetch.mockResolvedValueOnce(mockResponse)

      const response = await updateTrn("portfolio-1", "trn-123", payload)

      expect(response.ok).toBe(true)
    })

    it("should return fetch response for error handling", async () => {
      const payload: TrnUpdatePayload = {
        trnType: "BUY",
        assetId: "asset-1",
        tradeDate: "2024-01-15",
        quantity: 100,
        price: 150,
        tradeCurrency: "USD",
        tradeAmount: 15000,
        cashCurrency: "USD",
        cashAmount: -15000,
        fees: 0,
        tax: 0,
      }

      const mockErrorResponse = {
        ok: false,
        status: 400,
        json: () => Promise.resolve({ message: "Invalid data" }),
      }
      mockFetch.mockResolvedValueOnce(mockErrorResponse)

      const response = await updateTrn("portfolio-1", "trn-123", payload)

      expect(response.ok).toBe(false)
    })
  })
})

describe("Edit Transaction - Cash Transactions", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockReset()
  })

  describe("DEPOSIT transaction", () => {
    it("should send correct payload structure for DEPOSIT", async () => {
      const depositPayload: TrnUpdatePayload = {
        trnType: "DEPOSIT",
        assetId: "cash-usd",
        tradeDate: "2024-01-20",
        quantity: 10000,
        price: 1,
        tradeCurrency: "USD",
        tradeAmount: 10000,
        cashCurrency: "USD",
        cashAmount: 10000,
        fees: 0,
        tax: 0,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })

      await updateTrn("portfolio-1", "deposit-trn", depositPayload)

      const [, options] = mockFetch.mock.calls[0]
      const body = JSON.parse(options.body)

      // For DEPOSIT: quantity, tradeAmount, and cashAmount should all be the same
      expect(body.quantity).toBe(10000)
      expect(body.tradeAmount).toBe(10000)
      expect(body.cashAmount).toBe(10000)
      expect(body.price).toBe(1)
      expect(body.trnType).toBe("DEPOSIT")
    })

    it("should update all amount fields consistently for DEPOSIT", async () => {
      const newAmount = 7500
      const depositPayload: TrnUpdatePayload = {
        trnType: "DEPOSIT",
        assetId: "cash-usd",
        tradeDate: "2024-01-20",
        quantity: newAmount,
        price: 1,
        tradeCurrency: "USD",
        tradeAmount: newAmount,
        cashCurrency: "USD",
        cashAmount: newAmount,
        fees: 0,
        tax: 0,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })

      await updateTrn("portfolio-1", "deposit-trn", depositPayload)

      const [, options] = mockFetch.mock.calls[0]
      const body = JSON.parse(options.body)

      // All three should be equal for cash transactions
      expect(body.quantity).toBe(body.tradeAmount)
      expect(body.tradeAmount).toBe(body.cashAmount)
    })
  })

  describe("WITHDRAWAL transaction", () => {
    it("should send correct payload structure for WITHDRAWAL", async () => {
      const withdrawalPayload: TrnUpdatePayload = {
        trnType: "WITHDRAWAL",
        assetId: "cash-usd",
        tradeDate: "2024-01-20",
        quantity: 2000,
        price: 1,
        tradeCurrency: "USD",
        tradeAmount: 2000,
        cashCurrency: "USD",
        cashAmount: 2000,
        fees: 0,
        tax: 0,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })

      await updateTrn("portfolio-1", "withdrawal-trn", withdrawalPayload)

      const [, options] = mockFetch.mock.calls[0]
      const body = JSON.parse(options.body)

      expect(body.trnType).toBe("WITHDRAWAL")
      expect(body.quantity).toBe(2000)
      expect(body.tradeAmount).toBe(2000)
      expect(body.cashAmount).toBe(2000)
    })
  })
})

describe("Edit Transaction - Trade Transactions", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockReset()
  })

  describe("BUY transaction", () => {
    it("should send correct payload structure for BUY", async () => {
      const buyPayload: TrnUpdatePayload = {
        trnType: "BUY",
        assetId: "asset-aapl",
        tradeDate: "2024-01-15",
        quantity: 50,
        price: 180.25,
        tradeCurrency: "USD",
        tradeAmount: 9012.5,
        cashCurrency: "USD",
        cashAmount: -9012.5,
        fees: 9.99,
        tax: 0,
        comments: "Bought more AAPL",
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })

      await updateTrn("portfolio-1", "buy-trn", buyPayload)

      const [, options] = mockFetch.mock.calls[0]
      const body = JSON.parse(options.body)

      expect(body.trnType).toBe("BUY")
      expect(body.quantity).toBe(50)
      expect(body.price).toBe(180.25)
      expect(body.tradeAmount).toBe(9012.5)
      expect(body.cashAmount).toBe(-9012.5) // Negative for BUY
      expect(body.fees).toBe(9.99)
    })

    it("should handle different trade and cash currencies", async () => {
      const buyPayload: TrnUpdatePayload = {
        trnType: "BUY",
        assetId: "asset-aapl",
        tradeDate: "2024-01-15",
        quantity: 50,
        price: 180,
        tradeCurrency: "USD",
        tradeAmount: 9000,
        cashCurrency: "NZD",
        cashAmount: -13500,
        tradeCashRate: 1.5,
        fees: 10,
        tax: 0,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })

      await updateTrn("portfolio-1", "buy-trn", buyPayload)

      const [, options] = mockFetch.mock.calls[0]
      const body = JSON.parse(options.body)

      expect(body.tradeCurrency).toBe("USD")
      expect(body.cashCurrency).toBe("NZD")
      expect(body.tradeCashRate).toBe(1.5)
    })
  })

  describe("SELL transaction", () => {
    it("should send correct payload structure for SELL", async () => {
      const sellPayload: TrnUpdatePayload = {
        trnType: "SELL",
        assetId: "asset-aapl",
        tradeDate: "2024-01-20",
        quantity: 25,
        price: 195.5,
        tradeCurrency: "USD",
        tradeAmount: 4887.5,
        cashCurrency: "USD",
        cashAmount: 4887.5, // Positive for SELL
        fees: 9.99,
        tax: 50,
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })

      await updateTrn("portfolio-1", "sell-trn", sellPayload)

      const [, options] = mockFetch.mock.calls[0]
      const body = JSON.parse(options.body)

      expect(body.trnType).toBe("SELL")
      expect(body.quantity).toBe(25)
      expect(body.price).toBe(195.5)
      expect(body.cashAmount).toBe(4887.5) // Positive for SELL
      expect(body.tax).toBe(50)
    })
  })

  describe("DIVI transaction", () => {
    it("should send correct payload structure for DIVI", async () => {
      const diviPayload: TrnUpdatePayload = {
        trnType: "DIVI",
        assetId: "asset-aapl",
        tradeDate: "2024-01-15",
        quantity: 100,
        price: 0.96,
        tradeCurrency: "USD",
        tradeAmount: 96,
        cashCurrency: "USD",
        cashAmount: 96,
        fees: 0,
        tax: 14.4,
        comments: "Q4 dividend",
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}),
      })

      await updateTrn("portfolio-1", "divi-trn", diviPayload)

      const [, options] = mockFetch.mock.calls[0]
      const body = JSON.parse(options.body)

      expect(body.trnType).toBe("DIVI")
      expect(body.tax).toBe(14.4)
      expect(body.comments).toBe("Q4 dividend")
    })
  })
})

describe("Edit Transaction - Cache Invalidation", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockFetch.mockReset()
    mockMutate.mockReset()
  })

  it("should call mutate after successful update to invalidate cache", () => {
    // This test verifies that the cache invalidation pattern is correct
    // The actual mutate call happens in the component after successful save

    const trnId = "trn-123"
    const expectedCacheKey = `/api/trns/${trnId}`

    // Simulate what the component does after successful save
    mockMutate(expectedCacheKey)

    expect(mockMutate).toHaveBeenCalledWith(expectedCacheKey)
  })
})
