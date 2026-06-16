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

describe("StrategyGaugesStrip off-track caveat", () => {
  // Pension headline showing 125% would otherwise read as success even though
  // the plan's returns fall short of the 4% rule the gauge assumes.
  const pensionFi = {
    fiProgress: 80,
    retirementAgeFiProgress: 125.3,
  } as unknown as FiMetrics

  it("caveats the Retirement-Age FI gauge value when off-track", () => {
    render(
      <StrategyGaugesStrip
        fiMetrics={pensionFi}
        view="PENSION"
        singleHeadline
        offTrack
      />,
    )
    expect(screen.getByText("Retirement-Age FI")).toBeInTheDocument()
    // Value still shown, but appended with the plain-language 4%-rule caveat.
    expect(
      screen.getByText(/125\.3% — based on the 4% rule/),
    ).toBeInTheDocument()
  })

  it("leaves the Retirement-Age FI gauge uncaveated when on-track", () => {
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
