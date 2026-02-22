import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import PerformanceChart from "../PerformanceChart"
import useSwr from "swr"
import { PerformanceResponse } from "types/beancounter"

const mockMutate = jest.fn()
jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(),
  useSWRConfig: () => ({ mutate: mockMutate }),
}))
const mockUseSwr = useSwr as jest.MockedFunction<typeof useSwr>

// Mock the usePrivacyMode hook
jest.mock("@hooks/usePrivacyMode", () => ({
  usePrivacyMode: jest.fn(() => ({
    hideValues: false,
    toggleHideValues: jest.fn(),
  })),
}))

// Mock the useUserPreferences hook
jest.mock("@contexts/UserPreferencesContext", () => ({
  useUserPreferences: jest.fn(() => ({
    preferences: { enableTwr: false },
    isLoading: false,
    refetch: jest.fn(),
  })),
}))

const { usePrivacyMode } = jest.requireMock("@hooks/usePrivacyMode")
const { useUserPreferences } = jest.requireMock(
  "@contexts/UserPreferencesContext",
)

// Mock recharts to avoid canvas/SVG issues in JSDOM
jest.mock("recharts", () => ({
  AreaChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="area-chart">{children}</div>
  ),
  Area: ({ dataKey }: { dataKey: string }) => (
    <div data-testid={`area-${dataKey}`} />
  ),
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ReferenceLine: () => <div />,
}))

const mockPerformanceData: PerformanceResponse = {
  data: {
    currency: { code: "USD", symbol: "$", name: "US Dollar" },
    series: [
      {
        date: "2024-01-01",
        growthOf1000: 1000,
        marketValue: 50000,
        netContributions: 50000,
        cumulativeReturn: 0,
        cumulativeDividends: 0,
      },
      {
        date: "2024-06-01",
        growthOf1000: 1080,
        marketValue: 58000,
        netContributions: 52000,
        cumulativeReturn: 0.08,
        cumulativeDividends: 500,
      },
      {
        date: "2024-12-01",
        growthOf1000: 1150,
        marketValue: 65000,
        netContributions: 55000,
        cumulativeReturn: 0.15,
        cumulativeDividends: 1200,
      },
    ],
  },
}

describe("PerformanceChart", () => {
  beforeEach(() => {
    mockUseSwr.mockReset()
    mockMutate.mockReset()
    usePrivacyMode.mockReturnValue({
      hideValues: false,
      toggleHideValues: jest.fn(),
    })
    useUserPreferences.mockReturnValue({
      preferences: { enableTwr: false },
      isLoading: false,
      refetch: jest.fn(),
    })
    jest.spyOn(global, "fetch").mockResolvedValue({ ok: true } as Response)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("renders loading state", () => {
    mockUseSwr.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: undefined,
    } as ReturnType<typeof useSwr>)

    render(<PerformanceChart portfolioCode="TEST" />)

    const pulseElements = document.querySelectorAll(".animate-pulse")
    expect(pulseElements.length).toBeGreaterThan(0)
  })

  it("renders error state", () => {
    mockUseSwr.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: { message: "Network error" },
    } as ReturnType<typeof useSwr>)

    render(<PerformanceChart portfolioCode="TEST" />)

    expect(
      screen.getByText("Failed to load performance data"),
    ).toBeInTheDocument()
  })

  it("renders empty state when no series data", () => {
    mockUseSwr.mockReturnValue({
      data: {
        data: {
          currency: { code: "USD", symbol: "$", name: "US Dollar" },
          series: [],
        },
      },
      isLoading: false,
      error: undefined,
    } as ReturnType<typeof useSwr>)

    render(<PerformanceChart portfolioCode="TEST" />)

    expect(
      screen.getByText("No performance data available for this period"),
    ).toBeInTheDocument()
  })

  it("shows gain chart by default", () => {
    mockUseSwr.mockReturnValue({
      data: mockPerformanceData,
      isLoading: false,
      error: undefined,
    } as ReturnType<typeof useSwr>)

    render(<PerformanceChart portfolioCode="TEST" />)

    expect(screen.getByTestId("area-investmentGain")).toBeInTheDocument()
    expect(screen.queryByTestId("area-windowDividends")).not.toBeInTheDocument()
  })

  it("switches to guide when tab is clicked", () => {
    mockUseSwr.mockReturnValue({
      data: mockPerformanceData,
      isLoading: false,
      error: undefined,
    } as ReturnType<typeof useSwr>)

    render(<PerformanceChart portfolioCode="TEST" />)

    fireEvent.click(screen.getByRole("tab", { name: "Guide" }))

    expect(screen.getByTestId("performance-guide")).toBeInTheDocument()
    expect(screen.queryByTestId("area-investmentGain")).not.toBeInTheDocument()
  })

  it("switches back to gain chart from guide", () => {
    mockUseSwr.mockReturnValue({
      data: mockPerformanceData,
      isLoading: false,
      error: undefined,
    } as ReturnType<typeof useSwr>)

    render(<PerformanceChart portfolioCode="TEST" />)

    fireEvent.click(screen.getByRole("tab", { name: "Guide" }))
    fireEvent.click(screen.getByRole("tab", { name: "Investment Gain" }))

    expect(screen.getByTestId("area-investmentGain")).toBeInTheDocument()
    expect(screen.queryByTestId("performance-guide")).not.toBeInTheDocument()
  })

  it("shows educational content about TWR and XIRR in guide tab", () => {
    mockUseSwr.mockReturnValue({
      data: mockPerformanceData,
      isLoading: false,
      error: undefined,
    } as ReturnType<typeof useSwr>)

    render(<PerformanceChart portfolioCode="TEST" />)

    fireEvent.click(screen.getByRole("tab", { name: "Guide" }))

    const guide = screen.getByTestId("performance-guide")
    expect(
      screen.getByText("TWR Return (Time-Weighted Return)"),
    ).toBeInTheDocument()
    expect(
      screen.getByText("XIRR (Personal Rate of Return)"),
    ).toBeInTheDocument()
    expect(screen.getByText("Contributions & Dividends")).toBeInTheDocument()
    expect(guide.textContent).toContain("eliminates the effect of cash flow")
    expect(guide.textContent).toContain("annualised return")
  })

  it("displays TWR percentage in stats header", () => {
    mockUseSwr.mockReturnValue({
      data: mockPerformanceData,
      isLoading: false,
      error: undefined,
    } as ReturnType<typeof useSwr>)

    render(<PerformanceChart portfolioCode="TEST" />)

    expect(screen.getByText("+15.00%")).toBeInTheDocument()
  })

  it("displays investment gain in stats header", () => {
    mockUseSwr.mockReturnValue({
      data: mockPerformanceData,
      isLoading: false,
      error: undefined,
    } as ReturnType<typeof useSwr>)

    render(<PerformanceChart portfolioCode="TEST" />)

    expect(screen.getByText("+$10K")).toBeInTheDocument()
  })

  it("displays portfolio value in stats header", () => {
    mockUseSwr.mockReturnValue({
      data: mockPerformanceData,
      isLoading: false,
      error: undefined,
    } as ReturnType<typeof useSwr>)

    render(<PerformanceChart portfolioCode="TEST" />)

    expect(screen.getByText("$65K")).toBeInTheDocument()
  })

  it("displays dividend info in gain subtitle", () => {
    mockUseSwr.mockReturnValue({
      data: mockPerformanceData,
      isLoading: false,
      error: undefined,
    } as ReturnType<typeof useSwr>)

    render(<PerformanceChart portfolioCode="TEST" />)

    expect(
      screen.getByText("incl. $1K dividends (1.85% yield)"),
    ).toBeInTheDocument()
  })

  it("renders time range selector buttons", () => {
    mockUseSwr.mockReturnValue({
      data: mockPerformanceData,
      isLoading: false,
      error: undefined,
    } as ReturnType<typeof useSwr>)

    render(<PerformanceChart portfolioCode="TEST" />)

    expect(screen.getByText("3M")).toBeInTheDocument()
    expect(screen.getByText("6M")).toBeInTheDocument()
    expect(screen.getByText("1Y")).toBeInTheDocument()
    expect(screen.getByText("2Y")).toBeInTheDocument()
    expect(screen.getByText("ALL")).toBeInTheDocument()
  })

  it("changes months parameter when time range is clicked", () => {
    mockUseSwr.mockReturnValue({
      data: mockPerformanceData,
      isLoading: false,
      error: undefined,
    } as ReturnType<typeof useSwr>)

    render(<PerformanceChart portfolioCode="TEST" />)

    expect(mockUseSwr).toHaveBeenCalledWith(
      "/api/performance/TEST?months=12",
      expect.any(Function),
    )

    fireEvent.click(screen.getByText("6M"))

    expect(mockUseSwr).toHaveBeenCalledWith(
      "/api/performance/TEST?months=6",
      expect.any(Function),
    )
  })

  it("shows contributed amount", () => {
    mockUseSwr.mockReturnValue({
      data: mockPerformanceData,
      isLoading: false,
      error: undefined,
    } as ReturnType<typeof useSwr>)

    render(<PerformanceChart portfolioCode="TEST" />)

    expect(screen.getByText("$55K contributed")).toBeInTheDocument()
  })

  describe("privacy mode", () => {
    it("hides dollar amounts but shows percentages when privacy mode is enabled", () => {
      usePrivacyMode.mockReturnValue({
        hideValues: true,
        toggleHideValues: jest.fn(),
      })
      mockUseSwr.mockReturnValue({
        data: mockPerformanceData,
        isLoading: false,
        error: undefined,
      } as ReturnType<typeof useSwr>)

      render(<PerformanceChart portfolioCode="TEST" />)

      // Percentages should still be visible
      expect(screen.getByText("+15.00%")).toBeInTheDocument()

      // Dollar amounts should be masked
      expect(screen.queryByText("$65K")).not.toBeInTheDocument()
      expect(screen.queryByText("+$10K")).not.toBeInTheDocument()

      // Multiple elements should show masked values
      const maskedElements = screen.getAllByText(/\*\*\*\*/)
      expect(maskedElements.length).toBeGreaterThanOrEqual(2)

      // Dividend info should mask dollar amount but keep yield percentage
      expect(
        screen.getByText(/incl\. \*\*\*\* dividends \(1\.85% yield\)/),
      ).toBeInTheDocument()
    })
  })

  describe("responsive layout", () => {
    it("hides Portfolio Value column on mobile with hidden sm:block", () => {
      mockUseSwr.mockReturnValue({
        data: mockPerformanceData,
        isLoading: false,
        error: undefined,
      } as ReturnType<typeof useSwr>)

      render(<PerformanceChart portfolioCode="TEST" />)

      const portfolioValueLabel = screen.getByText("Portfolio Value")
      const portfolioValueColumn = portfolioValueLabel.parentElement
      expect(portfolioValueColumn).toHaveClass("hidden", "sm:block")
    })
  })

  describe("cache reset button", () => {
    it("is hidden when enableTwr is false", () => {
      mockUseSwr.mockReturnValue({
        data: mockPerformanceData,
        isLoading: false,
        error: undefined,
      } as ReturnType<typeof useSwr>)

      render(<PerformanceChart portfolioCode="TEST" />)

      expect(
        screen.queryByLabelText("Reset performance cache"),
      ).not.toBeInTheDocument()
    })

    it("is visible when enableTwr is true", () => {
      useUserPreferences.mockReturnValue({
        preferences: { enableTwr: true },
        isLoading: false,
        refetch: jest.fn(),
      })
      mockUseSwr.mockReturnValue({
        data: mockPerformanceData,
        isLoading: false,
        error: undefined,
      } as ReturnType<typeof useSwr>)

      render(<PerformanceChart portfolioCode="TEST" />)

      expect(
        screen.getByLabelText("Reset performance cache"),
      ).toBeInTheDocument()
    })

    it("calls DELETE API and triggers SWR mutate on click", async () => {
      useUserPreferences.mockReturnValue({
        preferences: { enableTwr: true },
        isLoading: false,
        refetch: jest.fn(),
      })
      mockUseSwr.mockReturnValue({
        data: mockPerformanceData,
        isLoading: false,
        error: undefined,
      } as ReturnType<typeof useSwr>)

      render(<PerformanceChart portfolioCode="TEST" />)

      fireEvent.click(screen.getByLabelText("Reset performance cache"))

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          "/api/performance/TEST/reset",
          { method: "DELETE" },
        )
      })

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith(
          "/api/performance/TEST?months=12",
        )
      })
    })
  })

  describe("backfill button", () => {
    it("is hidden when enableTwr is false", () => {
      mockUseSwr.mockReturnValue({
        data: mockPerformanceData,
        isLoading: false,
        error: undefined,
      } as ReturnType<typeof useSwr>)

      render(<PerformanceChart portfolioCode="TEST" />)

      expect(
        screen.queryByLabelText("Load historical prices"),
      ).not.toBeInTheDocument()
    })

    it("is visible when enableTwr is true", () => {
      useUserPreferences.mockReturnValue({
        preferences: { enableTwr: true },
        isLoading: false,
        refetch: jest.fn(),
      })
      mockUseSwr.mockReturnValue({
        data: mockPerformanceData,
        isLoading: false,
        error: undefined,
      } as ReturnType<typeof useSwr>)

      render(<PerformanceChart portfolioCode="TEST" />)

      expect(
        screen.getByLabelText("Load historical prices"),
      ).toBeInTheDocument()
    })

    it("calls POST API and triggers SWR mutate on click", async () => {
      useUserPreferences.mockReturnValue({
        preferences: { enableTwr: true },
        isLoading: false,
        refetch: jest.fn(),
      })
      mockUseSwr.mockReturnValue({
        data: mockPerformanceData,
        isLoading: false,
        error: undefined,
      } as ReturnType<typeof useSwr>)

      jest.spyOn(global, "fetch").mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            status: "ok",
            datesProcessed: 12,
            assetsProcessed: 5,
          }),
      } as Response)

      render(<PerformanceChart portfolioCode="TEST" />)

      fireEvent.click(screen.getByLabelText("Load historical prices"))

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith("/api/prices/backfill/TEST", {
          method: "POST",
        })
      })

      await waitFor(() => {
        expect(mockMutate).toHaveBeenCalledWith(
          "/api/performance/TEST?months=12",
        )
      })
    })
  })

  describe("data coverage banner", () => {
    it("shows info banner when firstTradeDate is after selected range start", () => {
      // Use a date that's only 2 months ago — well within the default 12-month window
      const now = new Date()
      const recentDate = new Date(now)
      recentDate.setMonth(recentDate.getMonth() - 2)
      const firstTradeDate = recentDate.toISOString().slice(0, 10)

      const dataWithFirstTrade: PerformanceResponse = {
        data: {
          ...mockPerformanceData.data,
          firstTradeDate,
        },
      }
      mockUseSwr.mockReturnValue({
        data: dataWithFirstTrade,
        isLoading: false,
        error: undefined,
      } as ReturnType<typeof useSwr>)

      // Default is 12 months, firstTradeDate is only 2 months of data
      render(<PerformanceChart portfolioCode="TEST" />)

      expect(screen.getByText(/Portfolio data starts/)).toBeInTheDocument()
    })

    it("hides info banner when firstTradeDate is not provided", () => {
      mockUseSwr.mockReturnValue({
        data: mockPerformanceData,
        isLoading: false,
        error: undefined,
      } as ReturnType<typeof useSwr>)

      render(<PerformanceChart portfolioCode="TEST" />)

      expect(
        screen.queryByText(/Portfolio data starts/),
      ).not.toBeInTheDocument()
    })
  })
})
