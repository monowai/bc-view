import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import ModelCard from "../ModelCard"
import { ModelDto } from "types/rebalance"

void React

function makeModel(overrides: Partial<ModelDto> = {}): ModelDto {
  return {
    id: "m1",
    name: "Growth Model",
    baseCurrency: "USD",
    risk: 4,
    shared: false,
    isOwner: true,
    currentPlanId: "p1",
    currentPlanVersion: 3,
    planCount: 1,
    createdAt: "2025-01-01",
    updatedAt: "2025-01-01",
    ...overrides,
  }
}

describe("ModelCard — list variant (SelectPlanDialog)", () => {
  it("renders name, objective, currency and plan version badges", () => {
    render(
      <ModelCard
        model={makeModel({ objective: "Long-term growth" })}
        variant="list"
        selected={false}
        onClick={() => {}}
      />,
    )

    expect(screen.getByText("Growth Model")).toBeInTheDocument()
    expect(screen.getByText("Long-term growth")).toBeInTheDocument()
    expect(screen.getByText("USD")).toBeInTheDocument()
    expect(screen.getByText(/v3/)).toBeInTheDocument()
  })

  it("calls onClick when clicked", () => {
    const onClick = jest.fn()
    render(
      <ModelCard
        model={makeModel()}
        variant="list"
        selected={false}
        onClick={onClick}
      />,
    )

    fireEvent.click(screen.getByRole("button"))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it("is type=button and reports aria-pressed, matching the grid variant", () => {
    const { rerender } = render(
      <ModelCard
        model={makeModel()}
        variant="list"
        selected={false}
        onClick={() => {}}
      />,
    )
    expect(screen.getByRole("button")).toHaveAttribute("type", "button")
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false")

    rerender(
      <ModelCard
        model={makeModel()}
        variant="list"
        selected
        onClick={() => {}}
      />,
    )
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true")
  })

  it("is disabled while loading another selection", () => {
    render(
      <ModelCard
        model={makeModel()}
        variant="list"
        selected={false}
        onClick={() => {}}
        disabled
      />,
    )

    expect(screen.getByRole("button")).toBeDisabled()
  })

  it("shows a spinner instead of the chevron affordance while loading", () => {
    const { container } = render(
      <ModelCard
        model={makeModel()}
        variant="list"
        selected
        onClick={() => {}}
        loading
      />,
    )

    expect(container.querySelector(".fa-chevron-right")).toBeNull()
  })
})

describe("ModelCard — grid variant (InvestCashDialog)", () => {
  it("renders name, objective, description, currency and risk", () => {
    render(
      <ModelCard
        model={makeModel({
          objective: "Long-term growth",
          description: "A balanced growth portfolio",
          risk: 5,
        })}
        variant="grid"
        selected={false}
        onClick={() => {}}
      />,
    )

    expect(screen.getByText("Growth Model")).toBeInTheDocument()
    expect(screen.getByText("Long-term growth")).toBeInTheDocument()
    expect(screen.getByText("A balanced growth portfolio")).toBeInTheDocument()
    expect(screen.getByText("USD")).toBeInTheDocument()
    expect(screen.getByLabelText("Risk 5 of 5")).toBeInTheDocument()
  })

  it("shows a Shared badge only when model.shared is true", () => {
    const { rerender } = render(
      <ModelCard
        model={makeModel({ shared: false })}
        variant="grid"
        selected={false}
        onClick={() => {}}
      />,
    )
    expect(screen.queryByText("Shared")).toBeNull()

    rerender(
      <ModelCard
        model={makeModel({ shared: true })}
        variant="grid"
        selected={false}
        onClick={() => {}}
      />,
    )
    expect(screen.getByText("Shared")).toBeInTheDocument()
  })

  it("marks the card aria-pressed when selected", () => {
    render(
      <ModelCard
        model={makeModel()}
        variant="grid"
        selected
        onClick={() => {}}
      />,
    )

    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true")
  })

  it("calls onClick when clicked", () => {
    const onClick = jest.fn()
    render(
      <ModelCard
        model={makeModel()}
        variant="grid"
        selected={false}
        onClick={onClick}
      />,
    )

    fireEvent.click(screen.getByRole("button"))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
