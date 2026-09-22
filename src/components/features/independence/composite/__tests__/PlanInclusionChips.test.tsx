import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import type { RetirementPlan } from "types/independence"
import PlanInclusionChips from "../PlanInclusionChips"

const plans = [
  { id: "a", name: "Go-Go" },
  { id: "b", name: "Slow Go" },
] as RetirementPlan[]

describe("PlanInclusionChips", () => {
  it("renders a checkbox chip per plan", () => {
    render(
      <PlanInclusionChips
        plans={plans}
        excludedPlanIds={new Set()}
        onToggle={jest.fn()}
      />,
    )
    expect(screen.getAllByRole("checkbox")).toHaveLength(2)
    expect(screen.getByRole("checkbox", { name: "Go-Go" })).toBeChecked()
  })

  it("shows an excluded plan unchecked and struck through", () => {
    render(
      <PlanInclusionChips
        plans={plans}
        excludedPlanIds={new Set(["b"])}
        onToggle={jest.fn()}
      />,
    )
    const slowGo = screen.getByRole("checkbox", { name: "Slow Go" })
    expect(slowGo).not.toBeChecked()
    expect(slowGo).toHaveClass("line-through")
  })

  it("reports a toggle by plan id", () => {
    const onToggle = jest.fn()
    render(
      <PlanInclusionChips
        plans={plans}
        excludedPlanIds={new Set()}
        onToggle={onToggle}
      />,
    )
    fireEvent.click(screen.getByRole("checkbox", { name: "Slow Go" }))
    expect(onToggle).toHaveBeenCalledWith("b")
  })

  it("offers no choice when there is only one plan", () => {
    const { container } = render(
      <PlanInclusionChips
        plans={[plans[0]]}
        excludedPlanIds={new Set()}
        onToggle={jest.fn()}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
