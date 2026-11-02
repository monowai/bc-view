import React from "react"
import { render } from "@testing-library/react"
import "@testing-library/jest-dom"
import PlanFiOverviewTab from "@components/features/independence/PlanFiOverviewTab"
import type { RetirementPlan, RetirementProjection } from "types/independence"
import type { ScenarioState } from "@components/features/independence/scenario/types"
import type { AssetBreakdown } from "@components/features/independence/useAssetBreakdown"

type ChartProps = Record<string, any>
const mockCaptured: Record<string, ChartProps[]> = {}

jest.mock("recharts", () => {
  const capture = (name: string) =>
    function Stub(props: ChartProps): React.ReactElement {
      ;(mockCaptured[name] ??= []).push(props)
      return <div>{props.children}</div>
    }
  return new Proxy(
    {},
    {
      get: (_t, name) => (name === "__esModule" ? true : capture(String(name))),
    },
  )
})

jest.mock("@components/features/independence/ChartFrame", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}))

jest.mock("@components/features/independence/useMonteCarloSimulation", () => ({
  useMonteCarloSimulation: () => ({
    result: {
      successRate: 90,
      iterations: 1000,
      terminalBalancePercentiles: { p10: 1, p25: 2, p50: 3, p75: 4, p90: 5 },
      yearlyBands: [{ year: 2055, p10: 1, p25: 2, p50: 3, p75: 4, p90: 5 }],
    },
    isRunning: false,
    error: null,
    runSimulation: jest.fn(),
  }),
}))

function renderTab(hideValues = false): void {
  Object.keys(mockCaptured).forEach((k) => delete mockCaptured[k])
  render(
    <PlanFiOverviewTab
      plan={
        {
          id: "plan-1",
          lifeExpectancy: 85,
          expensesCurrency: "SGD",
        } as unknown as RetirementPlan
      }
      projection={
        {
          planId: "plan-1",
          liquidAssets: 800_000,
          totalAssets: 800_000,
          yearlyProjections: [{ year: 2055, age: 60, endingBalance: 804_000 }],
          fiMetrics: {
            fiNumber: 900_000,
            fiProgress: 88,
            gapToFi: 100_000,
          },
        } as unknown as RetirementProjection
      }
      scenario={
        {
          currentAge: 35,
          retirementAge: 60,
          lifeExpectancy: 85,
        } as unknown as ScenarioState
      }
      assets={
        {
          liquidAssets: 800_000,
          totalAssets: 800_000,
          isLoaded: true,
        } as unknown as AssetBreakdown
      }
      monthlyInvestment={1_000}
      rentalIncome={undefined}
      displayCurrency={undefined}
      effectiveCurrency="SGD"
      currentAge={35}
      isCalculating={false}
      hideValues={hideValues}
    />,
  )
}

describe("PlanFiOverviewTab trajectory chart frame", () => {
  it("uses its own margin and always pins the y-domain", () => {
    renderTab()
    const { ComposedChart, CartesianGrid, XAxis, YAxis } = mockCaptured
    expect(ComposedChart[0].margin).toEqual({
      top: 4,
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
    expect(YAxis[0].domain[1]).toBeGreaterThan(0)
    expect(YAxis[0].tickFormatter(2_000_000)).toBe("2.0M")
  })

  it("masks the money axis with three stars in privacy mode", () => {
    renderTab(true)
    expect(mockCaptured.YAxis[0].tickFormatter(2_000_000)).toBe("***")
  })

  it("keeps the Monte Carlo bands out of the legend under percentile names", () => {
    renderTab()
    const bandArea = (dataKey: string): ChartProps =>
      mockCaptured.Area.find((p) => p.dataKey === dataKey) as ChartProps
    expect(bandArea("p10Base")).toEqual({
      type: "monotone",
      dataKey: "p10Base",
      fill: "transparent",
      stroke: "none",
      stackId: "outer",
      legendType: "none",
      isAnimationActive: false,
    })
    expect(bandArea("outerWidth")).toEqual({
      type: "monotone",
      dataKey: "outerWidth",
      fill: "rgba(34,197,94,0.09)",
      stroke: "none",
      stackId: "outer",
      legendType: "none",
      isAnimationActive: false,
      name: "p10–p90",
    })
    expect(bandArea("p25Base")).toMatchObject({
      stackId: "inner",
      legendType: "none",
    })
    expect(bandArea("innerWidth")).toMatchObject({
      fill: "rgba(34,197,94,0.15)",
      legendType: "none",
      name: "p25–p75",
    })
    expect(mockCaptured.Line.find((p) => p.dataKey === "p50")).toEqual({
      type: "monotone",
      dataKey: "p50",
      stroke: "rgba(34,197,94,0.55)",
      strokeWidth: 1.5,
      strokeDasharray: "5 4",
      dot: false,
      isAnimationActive: false,
      name: "Median (MC)",
    })
  })
})
