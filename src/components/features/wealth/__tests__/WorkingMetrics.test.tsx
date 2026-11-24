import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import WorkingMetrics from "../WorkingMetrics"
import type { WorkingBasis } from "@lib/independence/workingBasis"
import type { Currency } from "types/beancounter"

let hideValues = false
jest.mock("@hooks/usePrivacyMode", () => ({
  usePrivacyMode: () => ({ hideValues }),
}))

const usd = { code: "USD", symbol: "$" } as unknown as Currency

const basis: WorkingBasis = {
  currency: "USD",
  monthlyContribution: 2_000,
  outlook: {
    headline: {
      label: "Progress",
      value: 40,
      display: "40.0%",
      fillPercent: 40,
      byline: "of the way there",
    },
    independent: false,
    yearsToFi: 16,
    fiAge: 66,
    liquidationAge: 82,
    hasProperty: true,
  },
}

const renderTiles = (invested: number): HTMLElement =>
  render(
    <WorkingMetrics
      basis={basis}
      loading={false}
      invested={invested}
      displayCurrency={usd}
      onShowInvestments={jest.fn()}
    />,
  ).container

const barWidths = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll<HTMLElement>("[style]")).map(
    (bar) => bar.style.width,
  )

describe("WorkingMetrics — privacy mode", () => {
  afterEach(() => {
    hideValues = false
  })

  it("shows the investment progress bar and note when values are visible", () => {
    const container = renderTiles(1_000)
    expect(screen.getByText("50% of monthly target")).toBeInTheDocument()
    expect(barWidths(container)).toEqual(["50%", "40%"])
  })

  it("gives away no investment progress when values are hidden", () => {
    hideValues = true
    const container = renderTiles(1_000)
    expect(screen.queryByText(/of monthly target/)).not.toBeInTheDocument()
    expect(barWidths(container).filter((width) => width !== "0%")).toEqual([])
  })

  it("does not say the target was met when values are hidden", () => {
    hideValues = true
    renderTiles(5_000)
    expect(screen.queryByText("Target met!")).not.toBeInTheDocument()
  })

  it("does not say money was withdrawn when values are hidden", () => {
    hideValues = true
    const container = renderTiles(-500)
    expect(
      screen.queryByText("Net withdrawal (last 30 days)"),
    ).not.toBeInTheDocument()
    expect(container.querySelector(".bg-loss")).toBeNull()
  })

  it("masks every tile's figures when values are hidden", () => {
    hideValues = true
    renderTiles(1_000)
    expect(screen.getAllByText("****")).toHaveLength(4)
    expect(screen.queryByText("40.0%")).not.toBeInTheDocument()
    expect(screen.queryByText("of the way there")).not.toBeInTheDocument()
    expect(screen.queryByText("16")).not.toBeInTheDocument()
    expect(screen.queryByText("82")).not.toBeInTheDocument()
  })
})
