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
    it("searches LOCAL first for name matching, filtered to specific market", async () => {
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

      // Specific markets now search LOCAL first for code+name matching
      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("market=LOCAL"),
        )
      })

      // Label always includes market and type
      await waitFor(() => {
        expect(
          screen.getByText("VCT - Vector Ltd (NZX, Equity)"),
        ).toBeInTheDocument()
      })

      // Expand Search is always offered for specific market searches
      expect(
        screen.getByText("trn.asset.search.expandSearch"),
      ).toBeInTheDocument()
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

    it("shows Expand Search when LOCAL returns no results", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })

      // LOCAL returns empty
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      })

      render(<AssetSearch onSelect={mockOnSelect} />)

      const input = screen.getByRole("combobox")
      await user.type(input, "NEWCO")
      await flushAsync()

      // Should show expand option even with no results
      await waitFor(() => {
        expect(
          screen.getByText("trn.asset.search.expandSearch"),
        ).toBeInTheDocument()
      })

      // Only one fetch (LOCAL), no auto-expand
      expect(mockFetch).toHaveBeenCalledTimes(1)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("market=LOCAL"),
      )
    })

    it("shows Expand Search when specific market returns no results", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })

      // NZX returns empty
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      })

      render(
        <AssetSearch
          onSelect={mockOnSelect}
          knownMarkets={["NZX", "US"]}
        />,
      )

      const input = screen.getByRole("combobox")
      await user.type(input, "NZX:UNKNOWN")
      await flushAsync()

      // Should show expand option when specific market has no results
      await waitFor(() => {
        expect(
          screen.getByText("trn.asset.search.expandSearch"),
        ).toBeInTheDocument()
      })
    })
  })

  describe("expand search", () => {
    it("fetches FIGI and shows merged results when Expand Search is clicked", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })

      // LOCAL returns one result
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

      // Mock FIGI response
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
              {
                symbol: "VOOG",
                name: "Vanguard S&P 500 Growth ETF",
                market: "US",
                assetId: "id-voog",
              },
            ],
          }),
      })

      // Click expand
      await user.click(screen.getByText("trn.asset.search.expandSearch"))

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining("market=FIGI"),
        )
      })

      // Should show merged results (VOO deduped, VOOG new)
      await waitFor(() => {
        expect(
          screen.getByText("VOOG - Vanguard S&P 500 Growth ETF (US)"),
        ).toBeInTheDocument()
      })
    })

    it("shows no-results sentinel when expand returns nothing", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })

      // LOCAL returns empty
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      })

      render(<AssetSearch onSelect={mockOnSelect} />)

      const input = screen.getByRole("combobox")
      await user.type(input, "ZZZZZ")
      await flushAsync()

      await waitFor(() => {
        expect(
          screen.getByText("trn.asset.search.expandSearch"),
        ).toBeInTheDocument()
      })

      // FIGI also returns empty
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      })

      await user.click(screen.getByText("trn.asset.search.expandSearch"))

      await waitFor(() => {
        expect(
          screen.getByText("trn.asset.search.noResults"),
        ).toBeInTheDocument()
      })
    })

    it("shows create-asset link when noResultsHref is provided", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })

      // LOCAL returns empty
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      })

      render(
        <AssetSearch
          onSelect={mockOnSelect}
          noResultsHref="/assets/account"
        />,
      )

      const input = screen.getByRole("combobox")
      await user.type(input, "ZZZZZ")
      await flushAsync()

      // FIGI also returns empty
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      })

      await user.click(screen.getByText("trn.asset.search.expandSearch"))

      await waitFor(() => {
        expect(
          screen.getByText("trn.asset.search.createAsset"),
        ).toBeInTheDocument()
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
        expect(screen.getByText("MSFT - Microsoft Corp (US)")).toBeInTheDocument()
      })

      await user.click(screen.getByText("MSFT - Microsoft Corp (US)"))

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
        expect(screen.getByText("MSFT - Microsoft Corp (US)")).toBeInTheDocument()
      })

      // Select it first
      await user.click(screen.getByText("MSFT - Microsoft Corp (US)"))
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
        expect(screen.getByText("BBB - Asset B (US)")).toBeInTheDocument()
      })
      expect(screen.queryByText("AAA - Asset A (US)")).not.toBeInTheDocument()
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
