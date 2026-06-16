import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
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

describe("StrategyGaugesStrip Pension headline", () => {
  const pensionFi = {
    fiProgress: 80,
    retirementAgeFiProgress: 125.3,
    incomeCoverageAtRetirement: 62.5,
  } as unknown as FiMetrics

  it("uses Income Coverage as the Pension headline, labelled Pension Progress", () => {
    render(
      <StrategyGaugesStrip
        fiMetrics={pensionFi}
        view="PENSION"
        singleHeadline
      />,
    )
    expect(screen.getByText("Pension Progress")).toBeInTheDocument()
    expect(screen.getByText("62.5%")).toBeInTheDocument()
    // The retirement-age gauge is no longer the Pension headline.
    expect(
      screen.queryByText("Retirement-Age Progress"),
    ).not.toBeInTheDocument()
  })

  it("falls back to Retirement-Age Progress when income coverage is null", () => {
    render(
      <StrategyGaugesStrip
        fiMetrics={
          {
            fiProgress: 80,
            retirementAgeFiProgress: 125.3,
          } as unknown as FiMetrics
        }
        view="PENSION"
        singleHeadline
      />,
    )
    expect(screen.getByText("Retirement-Age Progress")).toBeInTheDocument()
    expect(screen.queryByText("Pension Progress")).not.toBeInTheDocument()
  })

  it("labels income-coverage gauge Income Coverage outside the Pension view", () => {
    render(<StrategyGaugesStrip fiMetrics={pensionFi} view="ALL" compact />)
    expect(screen.getByText("Income Coverage")).toBeInTheDocument()
    expect(screen.queryByText("Pension Progress")).not.toBeInTheDocument()
  })
})

describe("StrategyGaugesStrip off-track caveat", () => {
  // Pension headline showing 125% would otherwise read as success even though
  // the plan's returns fall short of the 4% rule the gauge assumes.
  const pensionFi = {
    fiProgress: 80,
    retirementAgeFiProgress: 125.3,
  } as unknown as FiMetrics

  it("keeps the off-track caveat OUT of the Retirement-Age gauge value", () => {
    render(
      <StrategyGaugesStrip
        fiMetrics={pensionFi}
        view="PENSION"
        singleHeadline
        offTrack
      />,
    )
    expect(screen.getByText("Retirement-Age Progress")).toBeInTheDocument()
    // Value stays clean — no inline 4%-rule suffix.
    expect(screen.getByText("125.3%")).toBeInTheDocument()
    expect(
      screen.queryByText(/125\.3% — based on the 4% rule/),
    ).not.toBeInTheDocument()
  })

  it("carries the off-track 4%-rule explanation in the gauge tooltip", () => {
    render(
      <StrategyGaugesStrip
        fiMetrics={pensionFi}
        view="PENSION"
        singleHeadline
        offTrack
      />,
    )
    fireEvent.mouseEnter(screen.getByText("Retirement-Age Progress"))
    expect(
      screen.getByText(
        /uses the 4% rule, which this plan's returns don't meet/,
      ),
    ).toBeInTheDocument()
  })

  it("leaves the Retirement-Age Progress gauge uncaveated when on-track", () => {
    render(
      <StrategyGaugesStrip
        fiMetrics={pensionFi}
        view="PENSION"
        singleHeadline
      />,
    )
    expect(screen.getByText("125.3%")).toBeInTheDocument()
    expect(screen.queryByText(/based on the 4% rule/)).not.toBeInTheDocument()
  })
})
