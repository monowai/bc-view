import React from "react"
import { render, screen, fireEvent, within } from "@testing-library/react"
import { PerformanceHeatmap, getHeatColor } from "../PerformanceHeatmap"
import {
  makeAsset,
  makeCashAsset,
  makeHoldingGroup,
  makePosition,
} from "@test-fixtures/beancounter"
import { HoldingGroup } from "types/beancounter"

const VALUE_IN = "PORTFOLIO"

function buildHoldingGroups(): Record<string, HoldingGroup> {
  const aapl = makePosition({
    asset: makeAsset({ id: "asset-aapl", code: "AAPL", name: "Apple Inc." }),
    moneyValues: {
      marketValue: 50000,
      weight: 0.5,
      irr: 0.12,
      gainOnDay: 500,
      priceData: {
        close: 150,
        previousClose: 149,
        change: 1,
        changePercent: 0.05,
        priceDate: "2024-01-15",
      },
    } as any,
  })

  // MSFT has no priceData.changePercent — the "no data" gray path.
  const msft = makePosition({
    asset: makeAsset({
      id: "asset-msft",
      code: "MSFT",
      name: "Microsoft Corp",
    }),
    moneyValues: {
      marketValue: 30000,
      weight: 0.3,
      irr: 0.08,
      gainOnDay: -100,
      priceData: {
        close: 300,
        previousClose: 300,
        change: 0,
        changePercent: undefined,
        priceDate: "2024-01-15",
      },
    } as any,
  })

  const cashPosition = makePosition({
    asset: makeCashAsset(),
    moneyValues: { marketValue: 5000, weight: 0.05 } as any,
  })

  const bond = makePosition({
    asset: makeAsset({
      id: "asset-bnd",
      code: "BND",
      name: "Vanguard Bond ETF",
    }),
    moneyValues: {
      marketValue: 20000,
      weight: 0.2,
      irr: 0.03,
      gainOnDay: 20,
      priceData: {
        close: 80,
        previousClose: 79.9,
        change: 0.1,
        changePercent: 0.0012,
        priceDate: "2024-01-15",
      },
    } as any,
  })

  return {
    Equity: makeHoldingGroup({
      positions: [aapl, msft, cashPosition],
      subTotals: {
        marketValue: 80000,
        totalGain: 8000,
        costValue: 60000,
        gainOnDay: 400,
        weightedIrr: 0.1,
      },
    }),
    Bonds: makeHoldingGroup({
      positions: [bond],
      subTotals: {
        marketValue: 20000,
        totalGain: 500,
        costValue: 19000,
        gainOnDay: 20,
        weightedIrr: 0.03,
      },
    }),
  }
}

describe("PerformanceHeatmap", () => {
  it("renders ticker codes of positions in Assets mode", () => {
    render(
      <PerformanceHeatmap
        holdingGroups={buildHoldingGroups()}
        valueIn={VALUE_IN}
        viewByGroup={false}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Assets" }))

    expect(screen.getByText("AAPL")).toBeInTheDocument()
    expect(screen.getByText("MSFT")).toBeInTheDocument()
    expect(screen.getByText("BND")).toBeInTheDocument()
    // Cash position is excluded from the heatmap entirely.
    expect(screen.queryByText(makeCashAsset().code)).not.toBeInTheDocument()
  })

  it("renders a position without priceData.changePercent gray, with no % chip", () => {
    render(
      <PerformanceHeatmap
        holdingGroups={buildHoldingGroups()}
        valueIn={VALUE_IN}
        viewByGroup={false}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Assets" }))

    const tile = screen.getByTestId("heatmap-tile-assets-MSFT")
    expect(tile).toHaveStyle({ backgroundColor: "#8a8f98" })
    expect(
      within(tile).queryByTestId("heatmap-chip-assets-MSFT"),
    ).not.toBeInTheDocument()

    // A tile that does have changePercent shows its chip.
    const aaplTile = screen.getByTestId("heatmap-tile-assets-AAPL")
    expect(
      within(aaplTile).getByTestId("heatmap-chip-assets-AAPL"),
    ).toBeInTheDocument()
  })

  it("Groups mode renders group names and opens a dialog listing its assets on click", () => {
    render(
      <PerformanceHeatmap
        holdingGroups={buildHoldingGroups()}
        valueIn={VALUE_IN}
        viewByGroup={true}
      />,
    )

    expect(screen.getAllByText("Equity").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Bonds").length).toBeGreaterThan(0)

    fireEvent.click(screen.getByTestId("heatmap-tile-groups-Equity"))

    // Dialog title + table rows for the group's (non-cash) assets.
    const dialogs = screen.getAllByText("Equity")
    expect(dialogs.length).toBeGreaterThan(1)
    expect(screen.getByText("Apple Inc.")).toBeInTheDocument()
    expect(screen.getByText("Microsoft Corp")).toBeInTheDocument()
  })

  it("switches metric label/values when toggled between Daily Gain and IRR", () => {
    render(
      <PerformanceHeatmap
        holdingGroups={buildHoldingGroups()}
        valueIn={VALUE_IN}
        viewByGroup={false}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Assets" }))

    // Default metric is Daily Gain — AAPL's changePercent is +5.00%.
    expect(screen.getByText("+5.00%")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "IRR" }))
    // AAPL's irr is 0.12 -> +12.00%
    expect(screen.getByText("+12.00%")).toBeInTheDocument()
  })

  it("defaults the internal view toggle from viewByGroup", () => {
    render(
      <PerformanceHeatmap
        holdingGroups={buildHoldingGroups()}
        valueIn={VALUE_IN}
        viewByGroup={true}
      />,
    )
    expect(screen.getByRole("button", { name: "Groups" })).toHaveClass(
      "bg-white",
    )
  })
})

describe("getHeatColor", () => {
  it("returns gray for null (no data)", () => {
    expect(getHeatColor(null, "dailyGain")).toBe("#8a8f98")
  })

  it("dailyGain: strong positive", () => {
    expect(getHeatColor(0.03, "dailyGain")).toBe("#1f4d21")
  })

  it("dailyGain: medium positive", () => {
    expect(getHeatColor(0.01, "dailyGain")).toBe("#37652f")
  })

  it("dailyGain: light positive", () => {
    expect(getHeatColor(0.005, "dailyGain")).toBe("#5f8f57")
  })

  it("dailyGain: flat band", () => {
    expect(getHeatColor(0, "dailyGain")).toBe("#66716b")
    expect(getHeatColor(0.0005, "dailyGain")).toBe("#66716b")
    expect(getHeatColor(-0.0005, "dailyGain")).toBe("#66716b")
  })

  it("dailyGain: light negative", () => {
    expect(getHeatColor(-0.005, "dailyGain")).toBe("#c96b60")
  })

  it("dailyGain: medium negative", () => {
    expect(getHeatColor(-0.01, "dailyGain")).toBe("#a03d36")
  })

  it("dailyGain: strong negative", () => {
    expect(getHeatColor(-0.03, "dailyGain")).toBe("#7f1d1d")
  })

  it("irr thresholds are scaled 5x vs dailyGain", () => {
    // 0.01 is only "light positive" for dailyGain but well within the
    // flat band for irr (flat band is +/-0.005 for dailyGain*5... wait
    // irr flat band is +/-0.005; 0.01 exceeds it -> light green).
    expect(getHeatColor(0.01, "irr")).toBe("#5f8f57")
    expect(getHeatColor(0.1, "irr")).toBe("#1f4d21")
    expect(getHeatColor(-0.1, "irr")).toBe("#7f1d1d")
    expect(getHeatColor(0.002, "irr")).toBe("#66716b")
  })
})
