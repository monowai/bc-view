import React from "react"
import { render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import WealthPointTooltip from "../WealthPointTooltip"

const item = (
  dataKey: string,
  value: number,
): { dataKey: string; value: number } => ({
  dataKey,
  value,
})

describe("WealthPointTooltip", () => {
  it("should lead with the exact value of the hovered point, label second", () => {
    const { container } = render(
      <WealthPointTooltip
        active
        label={69}
        payload={[item("endingBalance", 1_096_432.4)]}
        currency="SGD"
        hideValues={false}
        planName="Go-Go"
      />,
    )
    expect(screen.getByText("Age 69 — Go-Go")).toBeInTheDocument()
    expect(screen.getByText("S$1,096,432")).toBeInTheDocument()
    expect(screen.queryByText(/1\.10M/)).not.toBeInTheDocument()
    const text = container.textContent ?? ""
    expect(text.indexOf("S$1,096,432")).toBeLessThan(
      text.indexOf("Money you can spend"),
    )
  })

  it("should hide the value in privacy mode", () => {
    render(
      <WealthPointTooltip
        active
        label={69}
        payload={[item("endingBalance", 1_096_432)]}
        currency="SGD"
        hideValues
      />,
    )
    expect(screen.getByText("****")).toBeInTheDocument()
    expect(screen.queryByText(/1,096,432/)).not.toBeInTheDocument()
  })

  it("should render nothing when inactive or empty", () => {
    const { container } = render(
      <WealthPointTooltip
        active={false}
        label={69}
        payload={[]}
        currency="SGD"
        hideValues={false}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("should show the middle outcome and ranges from stacked band keys, never the raw keys", () => {
    const { container } = render(
      <WealthPointTooltip
        active
        label={70}
        payload={[
          item("p10Base", 800_000),
          item("outerWidth", 600_000),
          item("p25Base", 900_000),
          item("innerWidth", 300_000),
          item("p50", 1_050_000),
          item("endingBalance", 1_000_000),
        ]}
        currency="SGD"
        hideValues={false}
      />,
    )
    expect(screen.getByText("S$1,000,000")).toBeInTheDocument()
    expect(screen.getByText("S$1,050,000")).toBeInTheDocument()
    expect(screen.getByText("Middle outcome")).toBeInTheDocument()
    expect(screen.getByText("S$900,000 – S$1,200,000")).toBeInTheDocument()
    expect(screen.getByText("S$800,000 – S$1,400,000")).toBeInTheDocument()
    const text = container.textContent ?? ""
    expect(text).not.toMatch(/p10Base|outerWidth|p25Base|innerWidth/)
    // The point itself comes first, whatever order recharts hands the series over.
    expect(text.indexOf("S$1,000,000")).toBeLessThan(
      text.indexOf("S$1,050,000"),
    )
  })

  it("should spell out the made-of layers with exact values", () => {
    render(
      <WealthPointTooltip
        active
        label={65}
        payload={[
          item("liquidValue", 750_000),
          item("housingValue", 400_000),
          item("annuitizedValue", 120_000),
        ]}
        currency="NZD"
        hideValues={false}
      />,
    )
    expect(screen.getByText("NZ$750,000")).toBeInTheDocument()
    expect(screen.getByText("You can spend this")).toBeInTheDocument()
    expect(screen.getByText("NZ$400,000")).toBeInTheDocument()
    expect(screen.getByText("Tied up in property")).toBeInTheDocument()
    expect(screen.getByText("NZ$120,000")).toBeInTheDocument()
    expect(screen.getByText("Locked in CPF LIFE")).toBeInTheDocument()
  })
})
