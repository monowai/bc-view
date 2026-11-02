import React from "react"
import { render } from "@testing-library/react"
import TimelineTabContent from "@components/features/independence/TimelineTabContent"
import { RetirementProjection } from "types/independence"

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

const projection = {
  yearlyProjections: [
    {
      age: 65,
      year: 2040,
      endingBalance: 90000,
      investment: 100,
      withdrawals: 50,
      totalWealth: 90000,
      currency: "SGD",
    },
  ],
  accumulationProjections: [],
  monthlyExpenses: 3500,
} as unknown as RetirementProjection

function renderTab(hideValues: boolean): void {
  Object.keys(mockCaptured).forEach((k) => delete mockCaptured[k])
  render(
    <TimelineTabContent
      projection={projection}
      baselineProjection={null}
      retirementAge={65}
      lifeExpectancy={90}
      hideValues={hideValues}
      isCalculating={false}
    />,
  )
}

describe("TimelineTabContent — wealth and cash-flow chart frames", () => {
  it("gives both charts the same frame, age axis and money axis", () => {
    renderTab(false)
    const { ComposedChart, CartesianGrid, XAxis, YAxis } = mockCaptured
    expect(ComposedChart.length).toBeGreaterThanOrEqual(2)
    expect(XAxis.length).toBeGreaterThanOrEqual(2)
    ComposedChart.forEach((p) =>
      expect(p.margin).toEqual({ top: 10, right: 30, left: 20, bottom: 20 }),
    )
    CartesianGrid.forEach((p) =>
      expect(p).toEqual({ strokeDasharray: "3 3", stroke: "#e5e7eb" }),
    )
    XAxis.forEach((p) => {
      const { domain, ticks, ...rest } = p
      expect(domain).toHaveLength(2)
      expect(Array.isArray(ticks)).toBe(true)
      expect(rest).toEqual({
        dataKey: "age",
        label: { value: "Age", position: "insideBottom", offset: -10 },
        tick: { fontSize: 12 },
        type: "number",
        scale: "linear",
        allowDataOverflow: true,
      })
    })
    YAxis.forEach((p) => {
      expect(p.tick).toEqual({ fontSize: 12 })
      expect(p.tickFormatter(25000)).toBe("$25k")
    })
  })

  it("masks the money axis in privacy mode", () => {
    renderTab(true)
    mockCaptured.YAxis.forEach((p) =>
      expect(p.tickFormatter(25000)).toBe("****"),
    )
  })

  it("labels both tooltips by age and keeps their own series formatting", () => {
    renderTab(false)
    const tooltips = mockCaptured.Tooltip.filter((p) => p.formatter)
    tooltips.forEach((p) => expect(p.labelFormatter(61)).toBe("Age 61"))
    const seriesLabels = tooltips.map((p) => p.formatter(10, "fireBalance")[1])
    expect(seriesLabels).toEqual(
      expect.arrayContaining(["FIRE Path", "Returns & Income"]),
    )
  })
})
