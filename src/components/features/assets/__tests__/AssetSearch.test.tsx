import React from "react"
import { render, screen, waitFor, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import AssetSearch from "../AssetSearch"
import { AssetOption } from "types/beancounter"

// Mock next-i18next
jest.mock("next-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    ready: true,
  }),
}))

// Helper to flush debounce timers and async work
const flushAsync = async (): Promise<void> => {
  await act(() => {
    jest.advanceTimersByTime(350)
  })
  // Allow React to process state updates
  await act(async () => {
    await Promise.resolve()
  })
}

describe("AssetSearch", () => {
  const mockOnSelect = jest.fn()
  const mockFetch = global.fetch as jest.Mock

  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    mockFetch.mockReset()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("renders with placeholder text", () => {
    render(<AssetSearch onSelect={mockOnSelect} />)
    expect(
      screen.getByText("trn.asset.search.placeholder"),
    ).toBeInTheDocument()
  })

  describe("specific market search", () => {
    it("searches the given market directly without LOCAL-first", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                symbol: "VCT",
                name: "Vector Ltd",
                market: "NZX",
                assetId: "abc-123",
                currency: "NZD",
                type: "Equity",
              },
            ],
          }),
      })

      render(<AssetSearch onSelect={mockOnSelect} market="NZX" />)

      const input = screen.getByRole("combobox")
      await user.type(input, "VCT")
      await flushAsync()

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("market=NZX"),
        )
      })

      // Label should NOT include market for specific-market searches
      await waitFor(() => {
        expect(screen.getByText("VCT - Vector Ltd")).toBeInTheDocument()
      })
    })
  })

  describe("LOCAL-first search", () => {
    it("searches LOCAL first when no market is specified", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                symbol: "AAPL",
                name: "Apple Inc",
                market: "US",
                assetId: "id-1",
                currency: "USD",
              },
            ],
          }),
      })

      render(<AssetSearch onSelect={mockOnSelect} />)

      const input = screen.getByRole("combobox")
      await user.type(input, "AAPL")
      await flushAsync()

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("market=LOCAL"),
        )
      })

      // LOCAL results should include market in label
      await waitFor(() => {
        expect(screen.getByText("AAPL - Apple Inc (US)")).toBeInTheDocument()
      })
    })

    it("shows Expand Search option when LOCAL returns results", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                symbol: "VOO",
                name: "Vanguard S&P 500 ETF",
                market: "US",
                assetId: "id-voo",
              },
            ],
          }),
      })

      render(<AssetSearch onSelect={mockOnSelect} />)

      const input = screen.getByRole("combobox")
      await user.type(input, "VOO")
      await flushAsync()

      await waitFor(() => {
        expect(
          screen.getByText("trn.asset.search.expandSearch"),
        ).toBeInTheDocument()
      })
    })

    it("auto-expands to FIGI when LOCAL returns no results", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })

      // LOCAL returns empty
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      })

      // FIGI returns results
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                symbol: "NEWCO",
                name: "New Company",
                market: "US",
                currency: "USD",
              },
            ],
          }),
      })

      render(<AssetSearch onSelect={mockOnSelect} />)

      const input = screen.getByRole("combobox")
      await user.type(input, "NEWCO")
      await flushAsync()

      // Allow the auto-expand fetch
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2)
        expect(mockFetch).toHaveBeenNthCalledWith(
          1,
          expect.stringContaining("market=LOCAL"),
        )
        expect(mockFetch).toHaveBeenNthCalledWith(
          2,
          expect.stringContaining("market=FIGI"),
        )
      })
    })
  })

  describe("onSelect callback", () => {
    it("calls onSelect when an option is selected", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                symbol: "MSFT",
                name: "Microsoft Corp",
                market: "US",
                assetId: "msft-id",
                currency: "USD",
              },
            ],
          }),
      })

      render(<AssetSearch onSelect={mockOnSelect} market="US" />)

      const input = screen.getByRole("combobox")
      await user.type(input, "MSFT")
      await flushAsync()

      await waitFor(() => {
        expect(screen.getByText("MSFT - Microsoft Corp")).toBeInTheDocument()
      })

      await user.click(screen.getByText("MSFT - Microsoft Corp"))

      expect(mockOnSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          symbol: "MSFT",
          assetId: "msft-id",
          market: "US",
          currency: "USD",
        }),
      )
    })

    it("calls onSelect with null when cleared", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                symbol: "MSFT",
                name: "Microsoft Corp",
                market: "US",
                assetId: "msft-id",
                currency: "USD",
              },
            ],
          }),
      })

      render(<AssetSearch onSelect={mockOnSelect} market="US" isClearable />)

      const input = screen.getByRole("combobox")
      await user.type(input, "MSFT")
      await flushAsync()

      await waitFor(() => {
        expect(screen.getByText("MSFT - Microsoft Corp")).toBeInTheDocument()
      })

      // Select it first
      await user.click(screen.getByText("MSFT - Microsoft Corp"))
      mockOnSelect.mockClear()

      // Click the clear button (react-select renders an svg with role)
      const clearButton = screen.getByRole("combobox").closest("div")
      const clearIndicator = clearButton?.querySelector(
        "[class*='indicatorContainer']:first-of-type",
      )
      if (clearIndicator) {
        await user.click(clearIndicator)
        expect(mockOnSelect).toHaveBeenCalledWith(null)
      }
    })
  })

  describe("filterResults", () => {
    it("applies filterResults to exclude options", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                symbol: "AAA",
                name: "Asset A",
                market: "US",
                assetId: "id-a",
              },
              {
                symbol: "BBB",
                name: "Asset B",
                market: "US",
                assetId: "id-b",
              },
            ],
          }),
      })

      const filterResults = (results: AssetOption[]): AssetOption[] =>
        results.filter((r) => r.assetId !== "id-a")

      render(
        <AssetSearch
          onSelect={mockOnSelect}
          market="US"
          filterResults={filterResults}
        />,
      )

      const input = screen.getByRole("combobox")
      await user.type(input, "AA")
      await flushAsync()

      await waitFor(() => {
        expect(screen.getByText("BBB - Asset B")).toBeInTheDocument()
      })
      expect(screen.queryByText("AAA - Asset A")).not.toBeInTheDocument()
    })
  })

  describe("MARKET:KEYWORD parsing", () => {
    it("searches the parsed market when MARKET:KEYWORD syntax is used", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                symbol: "BHP",
                name: "BHP Group",
                market: "ASX",
                assetId: "bhp-id",
              },
            ],
          }),
      })

      render(
        <AssetSearch
          onSelect={mockOnSelect}
          knownMarkets={["ASX", "NZX", "US"]}
        />,
      )

      const input = screen.getByRole("combobox")
      await user.type(input, "ASX:BHP")
      await flushAsync()

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("market=ASX"),
        )
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("keyword=BHP"),
        )
      })
    })
  })
})
