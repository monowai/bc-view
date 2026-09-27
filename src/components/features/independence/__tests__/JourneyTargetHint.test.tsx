import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import JourneyTargetHint from "../JourneyTargetHint"

describe("JourneyTargetHint", () => {
  it("shows the amount in the plan currency, not a display currency", () => {
    render(
      <JourneyTargetHint amount={800000} currency="SGD" hideValues={false} />,
    )

    expect(
      screen.getByText("Overridden by the journey target (800,000 SGD)"),
    ).toBeInTheDocument()
  })

  it("rounds the amount", () => {
    render(
      <JourneyTargetHint amount={123456.7} currency="USD" hideValues={false} />,
    )

    expect(
      screen.getByText("Overridden by the journey target (123,457 USD)"),
    ).toBeInTheDocument()
  })

  it("masks the whole amount in privacy mode, without a bare currency code", () => {
    render(
      <JourneyTargetHint amount={800000} currency="SGD" hideValues={true} />,
    )

    expect(
      screen.getByText("Overridden by the journey target (****)"),
    ).toBeInTheDocument()
    expect(screen.queryByText(/SGD/)).not.toBeInTheDocument()
  })
})
