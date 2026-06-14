import React from "react"
import { render, screen } from "@testing-library/react"
import StrategyGaugesStrip from "../StrategyGaugesStrip"
import type { FiMetrics } from "types/independence"

const baseFi = {
  fiProgress: 106.3,
  coastFiProgress: 84.2,
} as unknown as FiMetrics

describe("StrategyGaugesStrip headline", () => {
  it("prefers the return-sensitive Coast FI gauge over static FIRE Progress", () => {
    render(
      <StrategyGaugesStrip fiMetrics={baseFi} view="FIRE" singleHeadline />,
    )
    expect(screen.getByText("Coast FI Progress")).toBeInTheDocument()
    expect(screen.queryByText("FIRE Progress")).not.toBeInTheDocument()
  })

  it("falls back to FIRE Progress when Coast FI is unavailable", () => {
    render(
      <StrategyGaugesStrip
        fiMetrics={{ fiProgress: 106.3 } as unknown as FiMetrics}
        view="FIRE"
        singleHeadline
      />,
    )
    expect(screen.getByText("FIRE Progress")).toBeInTheDocument()
  })
})
