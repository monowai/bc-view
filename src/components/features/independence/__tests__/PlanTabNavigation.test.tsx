import React from "react"
import { render, screen } from "@testing-library/react"
import PlanTabNavigation from "../PlanTabNavigation"

const noop = (): void => {}

describe("PlanTabNavigation", () => {
  it("shows the FI Overview tab when showFiTab is true (FIRE plans)", () => {
    render(
      <PlanTabNavigation
        activeTab="details"
        onTabChange={noop}
        hasAssets
        showFiTab
      />,
    )
    expect(screen.getByText("FI Overview")).toBeInTheDocument()
    expect(screen.getByText("My Plan")).toBeInTheDocument()
  })

  it("hides the FI Overview tab when showFiTab is false (non-FIRE plans)", () => {
    render(
      <PlanTabNavigation
        activeTab="details"
        onTabChange={noop}
        hasAssets
        showFiTab={false}
      />,
    )
    expect(screen.queryByText("FI Overview")).not.toBeInTheDocument()
    // Other tabs remain.
    expect(screen.getByText("My Plan")).toBeInTheDocument()
    expect(screen.getByText("Metrics")).toBeInTheDocument()
  })

  it("defaults to showing the FI Overview tab", () => {
    render(
      <PlanTabNavigation activeTab="details" onTabChange={noop} hasAssets />,
    )
    expect(screen.getByText("FI Overview")).toBeInTheDocument()
  })
})
