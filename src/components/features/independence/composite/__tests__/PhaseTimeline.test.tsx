import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import type { CompositePhase, RetirementPlan } from "types/independence"
import PhaseTimeline, { resolvePhases } from "../PhaseTimeline"

const plans = [
  { id: "a", name: "Go-Go" },
  { id: "b", name: "Slow Go" },
  { id: "c", name: "No-Go" },
] as RetirementPlan[]

const phases: CompositePhase[] = [
  { planId: "a", fromAge: 61, toAge: 70 },
  { planId: "b", fromAge: 70, toAge: 80 },
  { planId: "c", fromAge: 80 },
]

function renderBand(
  overrides: Partial<React.ComponentProps<typeof PhaseTimeline>> = {},
): {
  onSelect: jest.Mock
  onBoundaryChange: jest.Mock
} {
  const onSelect = jest.fn()
  const onBoundaryChange = jest.fn()
  render(
    <PhaseTimeline
      resolved={resolvePhases(phases, plans, 92)}
      selectedIndex={null}
      onSelect={onSelect}
      onBoundaryChange={onBoundaryChange}
      drawerId="drawer"
      {...overrides}
    />,
  )
  return { onSelect, onBoundaryChange }
}

describe("PhaseTimeline", () => {
  it("names each stage once, with its length", () => {
    renderBand()
    expect(screen.getByText("Go-Go")).toBeInTheDocument()
    expect(screen.getByText("9 yr")).toBeInTheDocument()
    expect(screen.getByText("Slow Go")).toBeInTheDocument()
    expect(screen.getByText("10 yr")).toBeInTheDocument()
    expect(screen.getByText("No-Go")).toBeInTheDocument()
    expect(screen.getByText("12 yr")).toBeInTheDocument()
  })

  it("reads the whole span from first start to horizon", () => {
    renderBand()
    expect(screen.getByText(/age 61 → 92 · 31 years/)).toBeInTheDocument()
  })

  it("carries each start age exactly once, on the seam it moves", () => {
    renderBand()
    expect(screen.getByLabelText("Go-Go starts at age")).toHaveValue("61")
    expect(screen.getByLabelText("Slow Go starts at age")).toHaveValue("70")
    expect(screen.getByLabelText("No-Go starts at age")).toHaveValue("80")
    // The horizon is the projection's, not a seam: read, never typed.
    expect(screen.getByText("to 92")).toBeInTheDocument()
    expect(screen.getAllByRole("textbox")).toHaveLength(3)
  })

  it("reports a moved seam by boundary index", () => {
    const { onBoundaryChange } = renderBand()
    fireEvent.change(screen.getByLabelText("Slow Go starts at age"), {
      target: { value: "72" },
    })
    expect(onBoundaryChange).toHaveBeenCalledWith(1, 72)
  })

  it("opens a stage on press and closes it on the second press", () => {
    const { onSelect } = renderBand()
    const slowGo = screen.getByRole("button", { name: /^Slow Go/ })
    expect(slowGo).toHaveAttribute("aria-expanded", "false")
    expect(slowGo).toHaveAttribute("aria-controls", "drawer")

    fireEvent.click(slowGo)
    expect(onSelect).toHaveBeenCalledWith(1)
  })

  it("marks the open stage and collapses it when pressed again", () => {
    const { onSelect } = renderBand({ selectedIndex: 1 })
    const slowGo = screen.getByRole("button", { name: /^Slow Go/ })
    expect(slowGo).toHaveAttribute("aria-expanded", "true")

    fireEvent.click(slowGo)
    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it("renders nothing with no stages", () => {
    const { container } = render(
      <PhaseTimeline
        resolved={[]}
        selectedIndex={null}
        onSelect={jest.fn()}
        onBoundaryChange={jest.fn()}
        drawerId="drawer"
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
