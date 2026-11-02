import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import EditPlanDetailsModal from "../EditPlanDetailsModal"
import { RetirementPlan } from "types/independence"
import useSWR from "swr"
import { usePrivateAssetConfigs } from "@utils/assets/usePrivateAssetConfigs"

jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(),
  mutate: jest.fn(),
  SWRConfig: ({ children }: { children: React.ReactNode }) => children,
}))

jest.mock("@utils/assets/usePrivateAssetConfigs", () => ({
  usePrivateAssetConfigs: jest.fn(),
}))

interface StubProps {
  value: number
  onChange: (value: number) => void
  className?: string
  min?: number
  max?: number
  step?: number
}

jest.mock("@components/ui/MathInput", () => ({
  __esModule: true,
  default: ({ value, onChange, className, min, max, step }: StubProps) => (
    <input
      data-testid="math-input"
      data-min={min}
      data-max={max}
      data-step={step}
      className={className}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  ),
}))

const plan = {
  id: "plan-1",
  name: "Plan",
  yearOfBirth: 1980,
  lifeExpectancy: 90,
  planningHorizonYears: 25,
  monthlyExpenses: 5000,
  expensesCurrency: "NZD",
  pensionMonthly: 1000,
  socialSecurityMonthly: 500,
  otherIncomeMonthly: 200,
  cashReturnRate: 0.03,
  equityReturnRate: 0.07,
  housingReturnRate: 0.04,
  inflationRate: 0.025,
  cashAllocation: 0.3,
  equityAllocation: 0.5,
  housingAllocation: 0.2,
} as RetirementPlan

const FIELD_CLASS =
  "w-full pl-2 pr-6 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500"

/** Inputs 1-6 in the modal, after the benefits start age. */
const PERCENT_FIELDS = [
  { max: 30, step: 0.5, value: 7 },
  { max: 20, step: 0.5, value: 3 },
  { max: 20, step: 0.5, value: 4 },
  { max: 100, step: 5, value: 50 },
  { max: 100, step: 5, value: 30 },
  { max: 100, step: 5, value: 20 },
]

function percentInputs(): HTMLInputElement[] {
  return (screen.getAllByTestId("math-input") as HTMLInputElement[]).filter(
    (i) => i.className === FIELD_CLASS,
  )
}

describe("EditPlanDetailsModal — rate and allocation fields", () => {
  beforeEach(() => {
    ;(useSWR as unknown as jest.Mock).mockReturnValue({
      data: { data: [] },
      isLoading: false,
      mutate: jest.fn(),
    })
    ;(usePrivateAssetConfigs as jest.Mock).mockReturnValue({
      configs: [],
      assetNames: {},
      isLoading: false,
    })
  })

  it("renders each with its own bounds, in order, with a % suffix and label", () => {
    render(
      <EditPlanDetailsModal
        plan={plan}
        onClose={jest.fn()}
        onApply={jest.fn()}
      />,
    )
    const inputs = percentInputs()
    expect(inputs).toHaveLength(PERCENT_FIELDS.length)
    inputs.forEach((input, i) => {
      expect(input).toHaveAttribute("data-min", "0")
      expect(input).toHaveAttribute("data-max", String(PERCENT_FIELDS[i].max))
      expect(input).toHaveAttribute("data-step", String(PERCENT_FIELDS[i].step))
      expect(Number(input.value)).toBeCloseTo(PERCENT_FIELDS[i].value)
      const wrapper = input.parentElement as HTMLElement
      expect(wrapper).toHaveClass("relative")
      expect(wrapper.querySelector("span")).toHaveTextContent("%")
      expect(wrapper.querySelector("span")).toHaveClass(
        "absolute",
        "right-2",
        "top-2.5",
        "text-xs",
        "text-gray-500",
      )
      const label = wrapper.previousElementSibling as HTMLElement
      expect(label.tagName).toBe("LABEL")
      expect(label).toHaveClass("block", "text-xs", "text-gray-500", "mb-1")
    })
    expect(
      inputs.map((i) => i.parentElement?.previousElementSibling?.textContent),
    ).toEqual(["Equity", "Cash", "Housing", "Equity", "Cash", "Housing"])
  })

  it("routes each edit to its own field", () => {
    const onApply = jest.fn()
    render(
      <EditPlanDetailsModal
        plan={plan}
        onClose={jest.fn()}
        onApply={onApply}
      />,
    )
    const next = [8, 4, 5, 40, 35, 25]
    percentInputs().forEach((input, i) =>
      fireEvent.change(input, { target: { value: String(next[i]) } }),
    )
    expect(screen.getByText(/% \(should equal 100%\)/)).toHaveTextContent(
      "Total: 100% (should equal 100%)",
    )

    fireEvent.click(screen.getByText("Apply"))
    expect(onApply).toHaveBeenCalledWith(
      expect.objectContaining({
        equityReturnRate: 0.08,
        cashReturnRate: 0.04,
        housingReturnRate: 0.05,
        equityAllocation: 0.4,
        cashAllocation: 0.35,
        housingAllocation: 0.25,
      }),
    )
  })
})
