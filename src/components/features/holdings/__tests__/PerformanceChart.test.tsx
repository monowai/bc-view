import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import PerformanceChart from "../PerformanceChart"
import useSwr from "swr"
import { PerformanceResponse } from "types/beancounter"

jest.mock("swr")
const mockUseSwr = useSwr as jest.MockedFunction<typeof useSwr>

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
    expect(
      screen.queryByTestId("area-cumulativeDividends"),
    ).not.toBeInTheDocument()
  })

  it("switches to income chart when tab is clicked", () => {
    mockUseSwr.mockReturnValue({
      data: mockPerformanceData,
      isLoading: false,
      error: undefined,
    } as ReturnType<typeof useSwr>)

    render(<PerformanceChart portfolioCode="TEST" />)

    fireEvent.click(screen.getByRole("tab", { name: "Income" }))

    expect(screen.getByTestId("area-cumulativeDividends")).toBeInTheDocument()
    expect(screen.queryByTestId("area-investmentGain")).not.toBeInTheDocument()
  })

  it("switches back to gain chart", () => {
    mockUseSwr.mockReturnValue({
      data: mockPerformanceData,
      isLoading: false,
      error: undefined,
    } as ReturnType<typeof useSwr>)

    render(<PerformanceChart portfolioCode="TEST" />)

    fireEvent.click(screen.getByRole("tab", { name: "Income" }))
    fireEvent.click(screen.getByRole("tab", { name: "Investment Gain" }))

    expect(screen.getByTestId("area-investmentGain")).toBeInTheDocument()
    expect(
      screen.queryByTestId("area-cumulativeDividends"),
    ).not.toBeInTheDocument()
  })

  it("shows empty state for income when no dividends", () => {
    const noDividendData: PerformanceResponse = {
      data: {
        ...mockPerformanceData.data,
        series: mockPerformanceData.data.series.map((p) => ({
          ...p,
          cumulativeDividends: 0,
        })),
      },
    }
    mockUseSwr.mockReturnValue({
      data: noDividendData,
      isLoading: false,
      error: undefined,
    } as ReturnType<typeof useSwr>)

    render(<PerformanceChart portfolioCode="TEST" />)

    fireEvent.click(screen.getByRole("tab", { name: "Income" }))

    expect(
      screen.getByText("No dividend income recorded for this period"),
    ).toBeInTheDocument()
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
      screen.getByText("incl. $1K dividends (1.8% yield)"),
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

  describe("IRR display", () => {
    it("renders IRR metric when portfolioIrr is provided and non-zero", () => {
      mockUseSwr.mockReturnValue({
        data: mockPerformanceData,
        isLoading: false,
        error: undefined,
      } as ReturnType<typeof useSwr>)

      render(<PerformanceChart portfolioCode="TEST" portfolioIrr={15.2} />)

      expect(screen.getByText("Your IRR")).toBeInTheDocument()
      expect(screen.getByText("+15.20%")).toBeInTheDocument()
    })

    it("hides IRR metric when portfolioIrr is undefined", () => {
      mockUseSwr.mockReturnValue({
        data: mockPerformanceData,
        isLoading: false,
        error: undefined,
      } as ReturnType<typeof useSwr>)

      render(<PerformanceChart portfolioCode="TEST" />)

      expect(screen.queryByText("Your IRR")).not.toBeInTheDocument()
    })

    it("hides IRR metric when portfolioIrr is zero", () => {
      mockUseSwr.mockReturnValue({
        data: mockPerformanceData,
        isLoading: false,
        error: undefined,
      } as ReturnType<typeof useSwr>)

      render(<PerformanceChart portfolioCode="TEST" portfolioIrr={0} />)

      expect(screen.queryByText("Your IRR")).not.toBeInTheDocument()
    })
  })
})
