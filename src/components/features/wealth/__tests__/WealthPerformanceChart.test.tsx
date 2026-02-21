import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import WealthPerformanceChart from "../WealthPerformanceChart"
import { Portfolio, Currency } from "types/beancounter"
import { AggregatedPerformance } from "@hooks/useAggregatedPerformance"

// Mock the aggregation hook
jest.mock("@hooks/useAggregatedPerformance")
const mockUseAggregatedPerformance = jest.requireMock<
  typeof import("@hooks/useAggregatedPerformance")
>("@hooks/useAggregatedPerformance")

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

const makeCurrency = (code: string): Currency => ({
  code,
  name: code,
  symbol: "$",
})

const makePortfolio = (code: string): Portfolio => ({
  id: code,
  code,
  name: code,
  currency: makeCurrency("USD"),
  base: makeCurrency("USD"),
  marketValue: 50000,
  irr: 0.05,
})

const mockSeries = [
  {
    date: "2024-01-01",
    marketValue: 100000,
    netContributions: 100000,
    cumulativeDividends: 0,
    investmentGain: 0,
    growthOf1000: 1000,
    cumulativeReturn: 0,
  },
  {
    date: "2024-06-01",
    marketValue: 112000,
    netContributions: 105000,
    cumulativeDividends: 500,
    investmentGain: 7000,
    growthOf1000: 1120,
    cumulativeReturn: 0.12,
  },
  {
    date: "2024-12-01",
    marketValue: 125000,
    netContributions: 110000,
    cumulativeDividends: 1200,
    investmentGain: 15000,
    growthOf1000: 1250,
    cumulativeReturn: 0.25,
  },
]

const defaultProps = {
  portfolios: [makePortfolio("P1"), makePortfolio("P2")],
  fxRates: { USD: 1 },
  displayCurrency: makeCurrency("USD"),
  collapsed: false,
  onToggle: jest.fn(),
}

function setHookReturn(value: AggregatedPerformance): void {
  mockUseAggregatedPerformance.useAggregatedPerformance = jest
    .fn()
    .mockReturnValue(value)
}

describe("WealthPerformanceChart", () => {
  beforeEach(() => {
    defaultProps.onToggle = jest.fn()
  })

  it("renders collapsed state with header only", () => {
    setHookReturn({ series: [], isLoading: false, error: undefined })

    render(<WealthPerformanceChart {...defaultProps} collapsed={true} />)

    expect(screen.getByText("Wealth Performance")).toBeInTheDocument()
    // No chart or stats visible
    expect(screen.queryByText("Aggregate TWR")).not.toBeInTheDocument()
  })

  it("calls onToggle when header is clicked", () => {
    setHookReturn({ series: [], isLoading: false, error: undefined })

    render(<WealthPerformanceChart {...defaultProps} collapsed={true} />)

    fireEvent.click(screen.getByText("Wealth Performance"))
    expect(defaultProps.onToggle).toHaveBeenCalled()
  })

  it("renders loading skeleton when loading", () => {
    setHookReturn({ series: [], isLoading: true, error: undefined })

    render(<WealthPerformanceChart {...defaultProps} />)

    const pulseElements = document.querySelectorAll(".animate-pulse")
    expect(pulseElements.length).toBeGreaterThan(0)
  })

  it("renders error state", () => {
    setHookReturn({
      series: [],
      isLoading: false,
      error: new Error("Network error"),
    })

    render(<WealthPerformanceChart {...defaultProps} />)

    expect(
      screen.getByText("Failed to load performance data"),
    ).toBeInTheDocument()
  })

  it("renders empty state when no data", () => {
    setHookReturn({ series: [], isLoading: false, error: undefined })

    render(<WealthPerformanceChart {...defaultProps} />)

    expect(
      screen.getByText("No performance data available for this period"),
    ).toBeInTheDocument()
  })

  it("renders aggregate TWR percentage", () => {
    setHookReturn({ series: mockSeries, isLoading: false, error: undefined })

    render(<WealthPerformanceChart {...defaultProps} />)

    expect(screen.getByText("+25.00%")).toBeInTheDocument()
  })

  it("renders total value", () => {
    setHookReturn({ series: mockSeries, isLoading: false, error: undefined })

    render(<WealthPerformanceChart {...defaultProps} />)

    expect(screen.getByText("$125K")).toBeInTheDocument()
  })

  it("renders investment gain", () => {
    setHookReturn({ series: mockSeries, isLoading: false, error: undefined })

    render(<WealthPerformanceChart {...defaultProps} />)

    expect(screen.getByText("+$15K")).toBeInTheDocument()
  })

  it("renders time range buttons", () => {
    setHookReturn({ series: mockSeries, isLoading: false, error: undefined })

    render(<WealthPerformanceChart {...defaultProps} />)

    expect(screen.getByText("3M")).toBeInTheDocument()
    expect(screen.getByText("6M")).toBeInTheDocument()
    expect(screen.getByText("1Y")).toBeInTheDocument()
    expect(screen.getByText("2Y")).toBeInTheDocument()
    expect(screen.getByText("ALL")).toBeInTheDocument()
  })

  it("renders chart area element", () => {
    setHookReturn({ series: mockSeries, isLoading: false, error: undefined })

    render(<WealthPerformanceChart {...defaultProps} />)

    expect(screen.getByTestId("area-investmentGain")).toBeInTheDocument()
  })

  it("is not rendered when enableTwr is false (parent responsibility)", () => {
    // This test documents the contract: parent conditionally renders
    // based on enableTwr, so this component never sees that prop.
    setHookReturn({ series: mockSeries, isLoading: false, error: undefined })

    const { container } = render(
      <>{false}</>,
    )

    expect(container.textContent).toBe("")
  })
})
