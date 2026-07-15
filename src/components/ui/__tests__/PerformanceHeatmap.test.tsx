import React from "react"
import { render, screen, fireEvent, within } from "@testing-library/react"
import {
  PerformanceHeatmap,
  getHeatColor,
  HeatTile,
} from "../PerformanceHeatmap"
import {
  makeAsset,
  makeCashAsset,
  makeHoldingGroup,
  makePortfolio,
  makePosition,
} from "@test-fixtures/beancounter"
import { HoldingGroup } from "types/beancounter"

const VALUE_IN = "PORTFOLIO"
const PORTFOLIO = makePortfolio()

// Page-groupBy keys are deliberately unrelated to sector names ("Group
// Alpha"/"Group Beta" vs. "Technology"/"Healthcare") to prove Groups mode
// regroups by sector and ignores the holdingGroups key entirely.
//
// AAPL and BND share a sector ("Technology") but have *different*
// assetCategory values (Equity vs. Fixed Income) — proving the grouping key
// is asset.sector, not asset.assetCategory.name. MSFT sits in a different
// sector ("Healthcare") despite sharing AAPL's assetCategory (Equity) —
// proving two same-category assets are NOT merged just because they share a
// category. CSCO carries no sector at all, exercising the "Unclassified"
// fallback.
function buildHoldingGroups(): Record<string, HoldingGroup> {
  const aapl = makePosition({
    asset: makeAsset({
      id: "asset-aapl",
      code: "AAPL",
      name: "Apple Inc.",
      sector: "Technology",
    }),
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
      sector: "Healthcare",
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
      assetCategory: { id: "BOND", name: "Fixed Income" },
      sector: "Technology",
    }),
    moneyValues: {
      marketValue: 20000,
      weight: 0.2,
      irr: 0.03,
      gainOnDay: 20,
      costValue: 19000,
      totalGain: 500,
      priceData: {
        close: 80,
        previousClose: 79.9,
        change: 0.1,
        changePercent: 0.0012,
        priceDate: "2024-01-15",
      },
    } as any,
  })

  // No sector at all — must fall back to the "Unclassified" group.
  const csco = makePosition({
    asset: makeAsset({
      id: "asset-csco",
      code: "CSCO",
      name: "Cisco Systems Inc.",
    }),
    moneyValues: {
      marketValue: 2000,
      weight: 0.02,
      irr: 0.05,
      gainOnDay: 5,
      priceData: {
        close: 50,
        previousClose: 49.9,
        change: 0.1,
        changePercent: 0.002,
        priceDate: "2024-01-15",
      },
    } as any,
  })

  return {
    "Group Alpha": makeHoldingGroup({
      positions: [aapl, msft, cashPosition, csco],
      subTotals: {
        marketValue: 82000,
        totalGain: 8000,
        costValue: 60000,
        gainOnDay: 405,
        weightedIrr: 0.1,
      },
    }),
    "Group Beta": makeHoldingGroup({
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
        portfolio={PORTFOLIO}
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
        portfolio={PORTFOLIO}
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

  it("Groups mode regroups by sector, not asset category or the page's holdingGroups key", () => {
    render(
      <PerformanceHeatmap
        holdingGroups={buildHoldingGroups()}
        valueIn={VALUE_IN}
        portfolio={PORTFOLIO}
        viewByGroup={true}
      />,
    )

    // Sector names show up as tiles...
    expect(screen.getAllByText("Technology").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Healthcare").length).toBeGreaterThan(0)
    // ...including the fallback for assets with no sector at all.
    expect(screen.getAllByText("Unclassified").length).toBeGreaterThan(0)
    // ...but asset-category names never appear as tiles in Groups mode.
    expect(screen.queryByText("Equity")).not.toBeInTheDocument()
    expect(screen.queryByText("Fixed Income")).not.toBeInTheDocument()
    // ...and the page's own grouping keys never appear as tiles.
    expect(screen.queryByText("Group Alpha")).not.toBeInTheDocument()
    expect(screen.queryByText("Group Beta")).not.toBeInTheDocument()
  })

  it("Groups mode opens a dialog listing a sector group's assets on click, merging assets across differing asset categories", () => {
    render(
      <PerformanceHeatmap
        holdingGroups={buildHoldingGroups()}
        valueIn={VALUE_IN}
        portfolio={PORTFOLIO}
        viewByGroup={true}
      />,
    )

    fireEvent.click(screen.getByTestId("heatmap-tile-groups-Technology"))

    // Dialog title + table rows for the sector group's assets. AAPL (Equity)
    // and BND (Fixed Income) both land in "Technology" — proving the group
    // is keyed by sector even though their asset categories differ.
    const dialogs = screen.getAllByText("Technology")
    expect(dialogs.length).toBeGreaterThan(1)
    expect(screen.getByText("Apple Inc.")).toBeInTheDocument()
    expect(screen.getByText("Vanguard Bond ETF")).toBeInTheDocument()
    // MSFT is in a different sector ("Healthcare") and must not appear here.
    expect(screen.queryByText("Microsoft Corp")).not.toBeInTheDocument()
  })

  it("switches metric label/values when toggled between Daily Gain and IRR", () => {
    render(
      <PerformanceHeatmap
        holdingGroups={buildHoldingGroups()}
        valueIn={VALUE_IN}
        portfolio={PORTFOLIO}
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
        portfolio={PORTFOLIO}
        viewByGroup={true}
      />,
    )
    expect(screen.getByRole("button", { name: "Groups" })).toHaveClass(
      "bg-white",
    )
  })

  it("Assets mode: clicking a tile opens a dialog with the holding-detail card", () => {
    render(
      <PerformanceHeatmap
        holdingGroups={buildHoldingGroups()}
        valueIn={VALUE_IN}
        portfolio={PORTFOLIO}
        viewByGroup={false}
      />,
    )
    fireEvent.click(screen.getByRole("button", { name: "Assets" }))

    fireEvent.click(screen.getByTestId("heatmap-tile-assets-AAPL"))

    // Dialog title shows the asset name (in addition to any tile label).
    expect(screen.getAllByText("Apple Inc.").length).toBeGreaterThan(0)
    // PositionCard content — stable labels rendered only by CardView's card,
    // never by the treemap tile itself.
    expect(screen.getByText("Quantity")).toBeInTheDocument()
    expect(screen.getByText("Current Value")).toBeInTheDocument()
  })
})

describe("HeatTile mobile compact typography", () => {
  const compactCell = {
    code: "SPY",
    name: "SPY",
    marketValue: 1000,
    totalGain: 50,
    totalGainPercent: 0.05,
    weight: 0.1,
    unrealisedGain: 50,
    irr: 0.05,
    changePercent: 0.01,
    gainOnDay: 10,
    costValue: 950,
  } as any

  it("still shows the ticker on a small (50x30) tile that would previously render blank", () => {
    render(
      <HeatTile
        cell={compactCell}
        rect={{ x: 0, y: 0, width: 50, height: 30 }}
        metric="dailyGain"
        mode="assets"
      />,
    )
    expect(screen.getByText("SPY")).toBeInTheDocument()
  })

  it("suppresses the redundant name subtitle when cell.name === cell.code", () => {
    const groupCell = {
      ...compactCell,
      code: "Large Blend",
      name: "Large Blend",
    } as any

    render(
      <HeatTile
        cell={groupCell}
        rect={{ x: 0, y: 0, width: 200, height: 150 }}
        metric="dailyGain"
        mode="groups"
      />,
    )
    // Only the ticker renders "Large Blend" — the subtitle is suppressed
    // because it would just repeat the ticker text.
    expect(screen.getAllByText("Large Blend")).toHaveLength(1)
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
