import React from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import useSwr from "swr"
import PerformanceChart from "../PerformanceChart"
import WealthPerformanceChart from "../../wealth/WealthPerformanceChart"
import { CHART_COLORS, ACTIVE_DOT } from "@lib/chart/performanceConstants"

type ChartProps = Record<string, any>
const mockCaptured: Record<string, ChartProps[]> = {}

jest.mock("recharts", () => {
  const capture = (name: string) =>
    function Stub(props: ChartProps): React.ReactElement {
      ;(mockCaptured[name] ??= []).push(props)
      return <g data-testid={`rc-${name}`}>{props.children}</g>
    }
  return new Proxy(
    {},
    {
      get: (_t, name) => (name === "__esModule" ? true : capture(String(name))),
    },
  )
})

jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(),
  useSWRConfig: () => ({ mutate: jest.fn().mockResolvedValue(undefined) }),
}))

let mockHideValues = false
jest.mock("@hooks/usePrivacyMode", () => ({
  usePrivacyMode: () => ({ hideValues: mockHideValues }),
}))

jest.mock("@contexts/UserPreferencesContext", () => ({
  useUserPreferences: () => ({ preferences: { enableTwr: true } }),
}))

const series = [
  {
    date: "2024-01-01",
    growthOf1000: 1000,
    marketValue: 50000,
    netContributions: 50000,
    lifetimeContributions: 50000,
    investmentGain: 0,
    cumulativeReturn: 0,
    cumulativeDividends: 0,
  },
  {
    date: "2024-12-01",
    growthOf1000: 1150,
    marketValue: 65000,
    netContributions: 55000,
    lifetimeContributions: 55000,
    investmentGain: 10000,
    cumulativeReturn: 0.15,
    cumulativeDividends: 0,
  },
]

let mockAggregated: unknown[] = series
jest.mock("@hooks/useAggregatedPerformance", () => ({
  useAggregatedPerformance: () => ({
    series: mockAggregated,
    xirr: null,
    isLoading: false,
    error: undefined,
  }),
}))

function resetCapture(hideValues = false): void {
  Object.keys(mockCaptured).forEach((k) => delete mockCaptured[k])
  mockHideValues = hideValues
  mockAggregated = series
  ;(useSwr as unknown as jest.Mock).mockReturnValue({
    data: {
      data: {
        currency: { code: "USD", symbol: "$", name: "US Dollar" },
        series,
      },
    },
    isLoading: false,
    error: undefined,
  })
}

const last = (name: string): ChartProps =>
  mockCaptured[name].at(-1) as ChartProps

function expectGainChart(fill: string, gradientId: string): void {
  const { tickFormatter: xFmt, ...x } = last("XAxis")
  expect(x).toEqual({
    minTickGap: 80,
    dataKey: "date",
    axisLine: false,
    tickLine: false,
    tick: {
      fontSize: 10,
      fill: CHART_COLORS.axis,
      fontFamily: "var(--font-jetbrains-mono)",
    },
    interval: "preserveStartEnd",
    dy: 4,
  })
  expect(xFmt("2024-06-15")).toBe("Jun '24")
  const y = last("YAxis")
  expect(y).toMatchObject({
    domain: ["auto", "auto"],
    axisLine: false,
    tickLine: false,
    width: 55,
  })
  expect(y.tickFormatter(1500)).toBe("$2K")
  expect(last("Tooltip").contentStyle.fontSize).toBe("12px")
  expect(last("Tooltip").labelFormatter("2024-06-15")).toContain("2024")
  expect(last("ReferenceLine")).toEqual({
    y: 0,
    stroke: CHART_COLORS.axis,
    strokeDasharray: "2 4",
    label: {
      value: "Break-even",
      position: "insideTopLeft",
      fill: CHART_COLORS.axis,
      fontSize: 10,
      fontFamily: "var(--font-dm-sans)",
    },
  })
  expect(last("Area")).toEqual({
    type: "monotone",
    dataKey: "investmentGain",
    stroke: CHART_COLORS.accent,
    strokeWidth: 2,
    fill,
    dot: false,
    activeDot: ACTIVE_DOT,
  })
  const gradient = document.querySelector("linearGradient") as SVGElement
  expect(gradient).toHaveAttribute("id", gradientId)
  expect(
    [...gradient.querySelectorAll("stop")].map((s) => [
      s.getAttribute("offset"),
      s.getAttribute("stop-opacity"),
    ]),
  ).toEqual([
    ["0%", "0.15"],
    ["100%", "0"],
  ])
}

describe("investment gain chart", () => {
  it("renders the holdings gain chart", () => {
    resetCapture()
    render(<PerformanceChart portfolioCode="TEST" />)
    expectGainChart("url(#gainFill)", "gainFill")
    expect(last("Tooltip").formatter(1234.5)).toEqual(["$1,234.50", "Gain"])
  })

  it("masks the holdings tooltip in privacy mode", () => {
    resetCapture(true)
    render(<PerformanceChart portfolioCode="TEST" />)
    expect(last("Tooltip").formatter(1234.5)).toEqual(["****", "Gain"])
  })

  it("renders the wealth gain chart with its own gradient id", () => {
    resetCapture()
    render(
      <WealthPerformanceChart
        portfolios={[]}
        displayCurrency={{ code: "USD", symbol: "$", name: "US Dollar" }}
        collapsed={false}
        onToggle={jest.fn()}
      />,
    )
    expectGainChart("url(#wealthGainFill)", "wealthGainFill")
    expect(last("Tooltip").formatter(1234.5)).toEqual(["$1,234.50", "Gain"])
  })

  it("renders the benchmark chart on the same axes, at the 1000 start line", () => {
    resetCapture()
    render(<PerformanceChart portfolioCode="TEST" />)
    fireEvent.click(screen.getByRole("tab", { name: "vs Benchmark" }))
    expect(last("YAxis").tickFormatter(1150.4)).toBe("1150")
    expect(last("XAxis").dataKey).toBe("date")
    expect(last("YAxis").width).toBe(55)
    expect(last("ReferenceLine")).toEqual({
      y: 1000,
      stroke: CHART_COLORS.axis,
      strokeDasharray: "2 4",
      label: {
        value: "Start (1000)",
        position: "insideTopLeft",
        fill: CHART_COLORS.axis,
        fontSize: 10,
        fontFamily: "var(--font-dm-sans)",
      },
    })
  })
})

describe("TWR action buttons", () => {
  const svgClass = (label: string): string =>
    screen.getByLabelText(label).querySelector("svg")?.getAttribute("class") ??
    ""

  beforeEach(() => {
    resetCapture()
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it.each([
    [
      "Load historical prices",
      "M3 12v3c0 1.657",
      3000,
      { status: "ok", datesProcessed: 1, assetsProcessed: 1 },
    ],
    ["Reset performance cache", "M4 2a1 1 0 011 1v2.101", 1500, {}],
  ])(
    "%s walks idle, spinning, done and back to idle",
    async (label, idlePath, doneMs, body) => {
      let resolve: (r: Response) => void = () => {}
      jest.spyOn(global, "fetch").mockReturnValue(
        new Promise((r) => {
          resolve = r
        }) as Promise<Response>,
      )
      render(<PerformanceChart portfolioCode="TEST" />)

      const button = screen.getByLabelText(label)
      expect(button).toHaveAttribute("title", label)
      expect(button).toHaveClass("p-1.5", "rounded", "text-gray-400")
      expect(button).toBeEnabled()
      expect(svgClass(label)).toBe("w-3.5 h-3.5")
      expect(button.querySelector("path")?.getAttribute("d")).toContain(
        idlePath,
      )

      fireEvent.click(button)
      expect(screen.getByLabelText(label)).toBeDisabled()
      expect(svgClass(label)).toBe("w-3.5 h-3.5 animate-spin")

      resolve({ ok: true, json: () => Promise.resolve(body) } as Response)
      await act(async () => {
        await jest.advanceTimersByTimeAsync(0)
      })
      expect(screen.getByLabelText(label)).toBeEnabled()
      expect(svgClass(label)).toBe("w-3.5 h-3.5 text-gain")

      await act(async () => {
        await jest.advanceTimersByTimeAsync(doneMs)
      })
      expect(svgClass(label)).toBe("w-3.5 h-3.5")
    },
  )
})
