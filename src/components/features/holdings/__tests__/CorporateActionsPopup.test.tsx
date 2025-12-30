import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import CorporateActionsPopup from "../CorporateActionsPopup"
import { Asset, CorporateEvent } from "types/beancounter"
import useSwr from "swr"

// Mock SWR
jest.mock("swr")
const mockUseSwr = useSwr as jest.MockedFunction<typeof useSwr>

const mockData = {
  data: [
    {
      id: "event-1",
      trnType: "DIVI",
      source: "ALPHA",
      assetId: "asset-aapl",
      recordDate: "2024-01-15",
      rate: 0.24,
      split: 1,
      payDate: "2024-02-01",
    },
    {
      id: "event-2",
      trnType: "SPLIT",
      source: "ALPHA",
      assetId: "asset-aapl",
      recordDate: "2024-03-01",
      rate: 0,
      split: 4,
      payDate: "2024-03-15",
    },
  ] as CorporateEvent[],
}

// Mock next-i18next
jest.mock("next-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      const translations: Record<string, string> = {
        loading: "Loading...",
        cancel: "Cancel",
        "corporate.title": "Corporate Actions",
        "corporate.view": "View Corporate Actions",
        "corporate.type": "Type",
        "corporate.type.dividend": "Dividend",
        "corporate.type.split": "Split",
        "corporate.recordDate": "Record Date",
        "corporate.payDate": "Pay Date",
        "corporate.effectiveDate": "Effective Date",
        "corporate.effectiveDate.hint": "Record date + 18 days for dividends",
        "corporate.rate": "Rate",
        "corporate.split": "Split Ratio",
        "corporate.actions": "Actions",
        "corporate.process": "Process",
        "corporate.noEvents": "No corporate actions found for this period",
        "corporate.error.retrieve": "Error retrieving corporate actions",
        "corporate.error.process": "Error processing event",
        "corporate.dateRange": `From ${params?.from || ""} to ${params?.to || ""}`,
        "corporate.loadEvents": "Load Events",
        "corporate.loading": "Loading...",
        "corporate.loadSuccess": "Events loaded",
        "corporate.info": "Corporate actions info",
        "corporate.payDate.clickToEdit": "Click to edit pay date",
        "corporate.payDate.pending": "Pay date pending",
        "corporate.saveAndProcess": "Save and process",
        "corporate.transactionCreated": "Created",
        "corporate.transactionCreated.hint": `Transaction created for ${params?.date || ""}`,
      }
      return translations[key] || key
    },
  }),
}))

const mockAsset: Asset = {
  id: "asset-aapl",
  code: "NASDAQ.AAPL",
  name: "Apple Inc",
  assetCategory: { id: "equity", name: "Equity" },
  market: {
    code: "NASDAQ",
    name: "NASDAQ Stock Exchange",
    currency: { code: "USD", name: "US Dollar", symbol: "$" },
  },
}

// Helper to create a mock SWR response
const mockSwrResponse = <T,>(
  data: T,
  error: Error | null = null,
  isLoading = false,
): {
  data: T
  error: Error | null
  isLoading: boolean
  mutate: jest.Mock
  isValidating: boolean
} => ({
  data,
  error,
  isLoading,
  mutate: jest.fn(),
  isValidating: false,
})

describe("CorporateActionsPopup", () => {
  const mockOnClose = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    // Mock current date for consistent tests
    jest.useFakeTimers()
    jest.setSystemTime(new Date("2024-06-15"))
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe("when modal is closed", () => {
    it("should render nothing when modalOpen is false", () => {
      mockUseSwr.mockReturnValue(mockSwrResponse(null))

      const { container } = render(
        <CorporateActionsPopup
          asset={mockAsset}
          portfolioId="test-portfolio-id"
          fromDate="2024-01-01"
          modalOpen={false}
          onClose={mockOnClose}
        />,
      )

      expect(container.firstChild).toBeNull()
    })
  })

  describe("when modal is open", () => {
    it("should display loading state", () => {
      mockUseSwr.mockReturnValue(mockSwrResponse(null, null, true))

      render(
        <CorporateActionsPopup
          asset={mockAsset}
          portfolioId="test-portfolio-id"
          fromDate="2024-01-01"
          modalOpen={true}
          onClose={mockOnClose}
        />,
      )

      expect(screen.getByText("Loading...")).toBeInTheDocument()
    })

    it("should display error state", () => {
      mockUseSwr.mockReturnValue(
        mockSwrResponse(null, new Error("Failed to fetch")),
      )

      render(
        <CorporateActionsPopup
          asset={mockAsset}
          portfolioId="test-portfolio-id"
          fromDate="2024-01-01"
          modalOpen={true}
          onClose={mockOnClose}
        />,
      )

      expect(
        screen.getByText("Error retrieving corporate actions"),
      ).toBeInTheDocument()
    })

    it("should display no events message when data is empty", () => {
      mockUseSwr.mockReturnValue(mockSwrResponse({ data: [] }))

      render(
        <CorporateActionsPopup
          asset={mockAsset}
          portfolioId="test-portfolio-id"
          fromDate="2024-01-01"
          modalOpen={true}
          onClose={mockOnClose}
        />,
      )

      expect(
        screen.getByText("No corporate actions found for this period"),
      ).toBeInTheDocument()
    })

    it("should display corporate events when data is available", () => {
      mockUseSwr.mockReturnValue(mockSwrResponse(mockData))

      render(
        <CorporateActionsPopup
          asset={mockAsset}
          portfolioId="test-portfolio-id"
          fromDate="2024-01-01"
          modalOpen={true}
          onClose={mockOnClose}
        />,
      )

      // Check header is displayed
      expect(
        screen.getByText("Corporate Actions - NASDAQ.AAPL"),
      ).toBeInTheDocument()

      // Check dividend event - effective date is recordDate + 18 days (2024-01-15 + 18 = 2024-02-02)
      expect(screen.getByText("Dividend")).toBeInTheDocument()
      expect(screen.getByText("2024-01-15")).toBeInTheDocument()
      // The effective pay date for dividends is calculated as recordDate + 18 days
      expect(screen.getByText("2024-02-02")).toBeInTheDocument()
      expect(screen.getByText("0.2400")).toBeInTheDocument()

      // Check split event - for splits, effective date equals recordDate
      expect(screen.getByText("Split")).toBeInTheDocument()
      expect(screen.getAllByText("2024-03-01").length).toBeGreaterThanOrEqual(1)
      expect(screen.getByText("4.0000")).toBeInTheDocument()
    })

    it("should call onClose when cancel button is clicked", () => {
      mockUseSwr.mockReturnValue(mockSwrResponse(mockData))

      render(
        <CorporateActionsPopup
          asset={mockAsset}
          portfolioId="test-portfolio-id"
          fromDate="2024-01-01"
          modalOpen={true}
          onClose={mockOnClose}
        />,
      )

      const cancelButton = screen.getByText("Cancel")
      fireEvent.click(cancelButton)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it("should call onClose when clicking the backdrop", () => {
      mockUseSwr.mockReturnValue(mockSwrResponse(mockData))

      render(
        <CorporateActionsPopup
          asset={mockAsset}
          portfolioId="test-portfolio-id"
          fromDate="2024-01-01"
          modalOpen={true}
          onClose={mockOnClose}
        />,
      )

      // Find and click the backdrop
      const backdrop = document.querySelector(".fixed.inset-0.bg-black")
      expect(backdrop).toBeInTheDocument()
      fireEvent.click(backdrop!)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it("should call onClose when clicking the X button", () => {
      mockUseSwr.mockReturnValue(mockSwrResponse(mockData))

      render(
        <CorporateActionsPopup
          asset={mockAsset}
          portfolioId="test-portfolio-id"
          fromDate="2024-01-01"
          modalOpen={true}
          onClose={mockOnClose}
        />,
      )

      const closeButton = document.querySelector(".fa-times")?.parentElement
      expect(closeButton).toBeInTheDocument()
      fireEvent.click(closeButton!)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it("should display date range information", () => {
      mockUseSwr.mockReturnValue(mockSwrResponse(mockData))

      render(
        <CorporateActionsPopup
          asset={mockAsset}
          portfolioId="test-portfolio-id"
          fromDate="2024-01-01"
          modalOpen={true}
          onClose={mockOnClose}
        />,
      )

      // Check that date inputs are present with correct values
      const fromInput = screen.getByDisplayValue("2024-01-01")
      const toInput = screen.getByDisplayValue("2024-06-15")
      expect(fromInput).toBeInTheDocument()
      expect(toInput).toBeInTheDocument()
    })
  })
})
