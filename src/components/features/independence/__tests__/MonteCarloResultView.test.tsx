import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import { fixtureMonteCarloResult } from "../__fixtures__/monteCarloResult"
import { MonteCarloResultView } from "../monte-carlo/MonteCarloResultView"

// Recharts uses DOM measurement APIs not available in jsdom.
// Fix ResponsiveContainer so child charts render at a fixed size.
jest.mock("recharts", () => {
  const original = jest.requireActual("recharts")
  return {
    ...original,
    ResponsiveContainer: ({
      children,
    }: {
      children: React.ReactNode
    }): React.ReactElement => (
      <div style={{ width: 800, height: 400 }}>{children}</div>
    ),
  }
})

const defaultProps = {
  result: fixtureMonteCarloResult,
  currency: "SGD",
  hideValues: false,
}

describe("MonteCarloResultView — mounts ConfidenceRibbon", () => {
  it("renders the ConfidenceRibbon headline below the FanChart", () => {
    render(<MonteCarloResultView {...defaultProps} />)
    // Fixture histogram produces p90=81 threshold for this result.
    // Headline will contain "9 in 10 futures still funded at age 81"
    expect(
      screen.getByText(/9 in 10 futures still funded at age 81/),
    ).toBeInTheDocument()
  })

  it("renders a confidence ribbon img region", () => {
    render(<MonteCarloResultView {...defaultProps} />)
    const ribbon = screen.getByRole("img")
    expect(ribbon).toBeInTheDocument()
    expect(ribbon).toHaveAttribute(
      "aria-label",
      expect.stringContaining("9 in 10 futures"),
    )
  })

  it("renders the 90% threshold label in the ribbon", () => {
    render(<MonteCarloResultView {...defaultProps} />)
    expect(screen.getByText("90% → 81")).toBeInTheDocument()
  })

  it("still renders the success rate card alongside the ribbon", () => {
    render(<MonteCarloResultView {...defaultProps} />)
    expect(screen.getByText("Success Rate")).toBeInTheDocument()
    expect(screen.getByText("72.5%")).toBeInTheDocument()
  })
})

describe("MonteCarloResultView — deterministic overlay", () => {
  it("should print the deterministic runway by default", () => {
    render(<MonteCarloResultView {...defaultProps} />)
    expect(screen.getByText(/Deterministic runway/)).toBeInTheDocument()
  })

  it("should omit the deterministic runway when the caller has none to show", () => {
    render(<MonteCarloResultView {...defaultProps} showDeterministic={false} />)
    expect(screen.queryByText(/Deterministic runway/)).not.toBeInTheDocument()
  })
})
