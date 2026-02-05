import { submitEditMode, submitExpense } from "./tradeSubmit"
import { TradeFormValues } from "./tradeFormHelpers"
import { Portfolio } from "types/beancounter"

// Mock dependencies
jest.mock("./apiHelper", () => ({
  updateTrn: jest.fn(),
}))

const { updateTrn } = jest.requireMock("./apiHelper")

// Mock global fetch for submitExpense
const mockFetch = jest.fn()
global.fetch = mockFetch

const baseFormData: TradeFormValues = {
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

const mockPortfolio: Portfolio = {
  id: "p1",
  code: "TEST",
  name: "Test Portfolio",
  currency: { code: "USD", name: "US Dollar", symbol: "$" },
  base: { code: "USD", name: "US Dollar", symbol: "$" },
  marketValue: 100000,
  irr: 0,
}

describe("tradeSubmit", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe("submitEditMode", () => {
    const transaction = {
      id: "trn-1",
      portfolio: { id: "p1", code: "TEST" },
      asset: { id: "asset-1" },
    }

    const makeParams = (overrides = {}): any => ({
      data: baseFormData,
      transaction,
      selectedModelId: undefined as string | undefined,
      selectedPortfolioId: "p1",
      portfolioChanged: false,
      portfolios: [mockPortfolio],
      editMode: { onClose: jest.fn() },
      mutate: jest.fn().mockResolvedValue(undefined),
      setSubmitError: jest.fn(),
      setIsSubmitting: jest.fn(),
      t: (key: string): string => key,
      ...overrides,
    })

    test("calls setIsSubmitting(true) at start and setIsSubmitting(false) at end", async () => {
      updateTrn.mockResolvedValue({ ok: true })
      const params = makeParams()

      await submitEditMode(params)

      expect(params.setIsSubmitting).toHaveBeenCalledWith(true)
      expect(params.setIsSubmitting).toHaveBeenLastCalledWith(false)
    })

    test("calls onClose on success", async () => {
      updateTrn.mockResolvedValue({ ok: true })
      const params = makeParams()

      await submitEditMode(params)

      expect(params.editMode.onClose).toHaveBeenCalled()
    })

    test("schedules mutate calls on success", async () => {
      updateTrn.mockResolvedValue({ ok: true })
      const params = makeParams()

      await submitEditMode(params)
      jest.advanceTimersByTime(1500)

      expect(params.mutate).toHaveBeenCalledWith(
        "/api/holdings/TEST?asAt=today",
      )
      expect(params.mutate).toHaveBeenCalledWith(
        "/api/holdings/aggregated?asAt=today",
      )
    })

    test("mutates new portfolio on portfolio change", async () => {
      const newPortfolio = { ...mockPortfolio, id: "p2", code: "NEW" }
      updateTrn.mockResolvedValue({ ok: true })
      const params = makeParams({
        portfolioChanged: true,
        selectedPortfolioId: "p2",
        portfolios: [mockPortfolio, newPortfolio],
      })

      await submitEditMode(params)
      jest.advanceTimersByTime(1500)

      expect(params.mutate).toHaveBeenCalledWith("/api/holdings/NEW?asAt=today")
    })

    test("sets error on non-ok response", async () => {
      updateTrn.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: "Not found" }),
      })
      const params = makeParams()

      await submitEditMode(params)

      expect(params.setSubmitError).toHaveBeenCalledWith("Not found")
      expect(params.editMode.onClose).not.toHaveBeenCalled()
    })

    test("sets error on exception", async () => {
      updateTrn.mockRejectedValue(new Error("Network failure"))
      const params = makeParams()

      await submitEditMode(params)

      expect(params.setSubmitError).toHaveBeenCalledWith("trn.error.update")
    })
  })

  describe("submitExpense", () => {
    const expenseFormData: TradeFormValues = {
      ...baseFormData,
      type: { value: "EXPENSE", label: "EXPENSE" },
      asset: "APT",
      tradeAmount: 500,
      quantity: 0,
      price: 0,
    }

    const makeParams = (overrides = {}): any => ({
      data: expenseFormData,
      portfolio: mockPortfolio,
      mutate: jest.fn().mockResolvedValue(undefined),
      setModalOpen: jest.fn(),
      setSubmitError: jest.fn(),
      setIsSubmitting: jest.fn(),
      ...overrides,
    })

    test("calls setIsSubmitting(true) at start and setIsSubmitting(false) at end", async () => {
      mockFetch.mockResolvedValue({ ok: true })
      const params = makeParams()

      await submitExpense(params)

      expect(params.setIsSubmitting).toHaveBeenCalledWith(true)
      expect(params.setIsSubmitting).toHaveBeenLastCalledWith(false)
    })

    test("posts expense payload to /api/trns", async () => {
      mockFetch.mockResolvedValue({ ok: true })
      const params = makeParams()

      await submitExpense(params)

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/trns",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
      )
    })

    test("closes modal on success", async () => {
      mockFetch.mockResolvedValue({ ok: true })
      const params = makeParams()

      await submitExpense(params)

      expect(params.setModalOpen).toHaveBeenCalledWith(false)
    })

    test("schedules mutate calls on success", async () => {
      mockFetch.mockResolvedValue({ ok: true })
      const params = makeParams()

      await submitExpense(params)
      jest.advanceTimersByTime(1500)

      expect(params.mutate).toHaveBeenCalledWith(
        "/api/holdings/TEST?asAt=today",
      )
      expect(params.mutate).toHaveBeenCalledWith(
        "/api/holdings/aggregated?asAt=today",
      )
    })

    test("sets error on non-ok response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: () => Promise.resolve({ message: "Invalid expense" }),
      })
      const params = makeParams()

      await submitExpense(params)

      expect(params.setSubmitError).toHaveBeenCalledWith("Invalid expense")
      expect(params.setModalOpen).not.toHaveBeenCalled()
    })

    test("sets error on network failure", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"))
      const params = makeParams()

      await submitExpense(params)

      expect(params.setSubmitError).toHaveBeenCalledWith("Network error")
    })
  })
})
