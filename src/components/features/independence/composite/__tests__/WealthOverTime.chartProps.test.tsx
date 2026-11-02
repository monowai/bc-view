import React from "react"
import { render } from "@testing-library/react"
import "@testing-library/jest-dom"
import type { CompositeProjectionResult } from "types/independence"
import {
  CompositeProjectionProvider,
  type CompositeProjectionValue,
} from "../CompositeProjectionContext"

type ChartProps = Record<string, any>
const mockCaptured: Record<string, ChartProps[]> = {}
let mockHideValues = false

jest.mock("recharts", () => {
  const capture = (name: string) =>
    function Stub(props: ChartProps): React.ReactElement {
      ;(mockCaptured[name] ??= []).push(props)
      return <div>{name === "Tooltip" ? null : props.children}</div>
    }
  return new Proxy(
    {},
    {
      get: (_t, name) => (name === "__esModule" ? true : capture(String(name))),
    },
  )
})

jest.mock("@hooks/usePrivacyMode", () => ({
  usePrivacyMode: () => ({ hideValues: mockHideValues }),
}))

import WealthOverTime from "../WealthOverTime"

const row = (age: number): never =>
  ({ age, year: 2026 + age - 61, endingBalance: 1_000_000 + age }) as never

const mcResult = {
  successRate: 90,
  iterations: 1000,
  terminalBalancePercentiles: { p10: 1, p25: 2, p50: 3, p75: 4, p90: 5 },
  depletionAgeDistribution: { depletedCount: 0 },
  yearlyBands: [{ year: 2026, p10: 1, p25: 2, p50: 3, p75: 4, p90: 5 }],
}

function renderChart(hideValues = false): void {
  Object.keys(mockCaptured).forEach((k) => delete mockCaptured[k])
  mockHideValues = hideValues
  const ctx = {
    plans: [],
    phases: [],
    setPhases: jest.fn(),
    displayCurrency: "SGD",
    setDisplayCurrency: jest.fn(),
    excludedPlanIds: new Set<string>(),
    toggleExclusion: jest.fn(),
    setCompositeWorkScenarioId: jest.fn(),
    refreshProjection: jest.fn(),
    currentAge: 59,
    projection: {
      asOfDate: "2026-09-18",
      displayCurrency: "SGD",
      phases: [],
      totalAssets: 0,
      liquidAssets: 500_000,
      fiNumber: 1_810_000,
      runwayYears: 30,
      isSustainable: true,
      yearlyProjections: [row(61), row(62)],
      warnings: [],
    } as unknown as CompositeProjectionResult,
    isLoading: false,
    isSettled: true,
    error: null,
    mc: { result: mcResult, isRunning: false, error: null, run: jest.fn() },
  } as unknown as CompositeProjectionValue
  render(
    <CompositeProjectionProvider value={ctx}>
      <WealthOverTime />
    </CompositeProjectionProvider>,
  )
}

describe("WealthOverTime chart frame", () => {
  it("uses the journey chart's margin, axes and y-domain", () => {
    renderChart()
    const { ComposedChart, CartesianGrid, XAxis, YAxis } = mockCaptured
    expect(ComposedChart[0].margin).toEqual({
      top: 8,
      right: 16,
      bottom: 20,
      left: 0,
    })
    expect(CartesianGrid[0]).toEqual({
      strokeDasharray: "3 3",
      stroke: "#f1f5f9",
      vertical: false,
    })
    const { domain, ticks, ...x } = XAxis[0]
    expect(domain).toHaveLength(2)
    expect(Array.isArray(ticks)).toBe(true)
    expect(x).toEqual({
      dataKey: "age",
      type: "number",
      scale: "linear",
      allowDataOverflow: true,
      tick: { fontSize: 11, fill: "#94a3b8" },
      tickLine: false,
      axisLine: false,
      label: {
        value: "Age",
        position: "insideBottom",
        offset: -10,
        fontSize: 11,
        fill: "#94a3b8",
      },
    })
    expect(YAxis[0]).toMatchObject({
      tick: { fontSize: 11, fill: "#94a3b8" },
      tickLine: false,
      axisLine: false,
      width: 54,
    })
    expect(YAxis[0].domain[0]).toBe(0)
    expect(YAxis[0].tickFormatter(2_000_000)).toBe("2.0M")
  })

  it("masks the money axis with three stars in privacy mode", () => {
    renderChart(true)
    expect(mockCaptured.YAxis[0].tickFormatter(2_000_000)).toBe("***")
  })

  it("names the Monte Carlo bands in plain words and leaves their legend type alone", () => {
    renderChart()
    const bandArea = (dataKey: string): ChartProps =>
      mockCaptured.Area.find((p) => p.dataKey === dataKey) as ChartProps
    expect(bandArea("p10Base")).toEqual({
      type: "monotone",
      dataKey: "p10Base",
      fill: "transparent",
      stroke: "none",
      stackId: "outer",
      isAnimationActive: false,
    })
    expect(bandArea("outerWidth")).toEqual({
      type: "monotone",
      dataKey: "outerWidth",
      fill: "rgba(34,197,94,0.09)",
      stroke: "none",
      stackId: "outer",
      isAnimationActive: false,
      name: "Range of outcomes",
    })
    expect(bandArea("p25Base").stackId).toBe("inner")
    expect(bandArea("innerWidth")).toMatchObject({
      fill: "rgba(34,197,94,0.15)",
      name: "Most likely range",
    })
    expect(bandArea("innerWidth")).not.toHaveProperty("legendType")
    expect(mockCaptured.Line.find((p) => p.dataKey === "p50")).toEqual({
      type: "monotone",
      dataKey: "p50",
      stroke: "rgba(34,197,94,0.55)",
      strokeWidth: 1.5,
      strokeDasharray: "5 4",
      dot: false,
      isAnimationActive: false,
      name: "Middle outcome",
    })
  })
})
