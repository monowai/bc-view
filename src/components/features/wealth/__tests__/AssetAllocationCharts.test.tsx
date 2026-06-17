import React from "react"
import { render, screen, fireEvent, RenderResult } from "@testing-library/react"
import "@testing-library/jest-dom"
import AssetAllocationCharts from "../AssetAllocationCharts"
import { USD } from "@test-fixtures/beancounter"
import { WealthSummary } from "@lib/wealth/liquidityGroups"
import { HoldingContract } from "types/beancounter"

// Deterministic group-by default; avoid persisted localStorage state.
jest.mock("@lib/storage/localState", () => ({
  getLocalValue: (_key: string, fallback: unknown) => fallback,
  setLocalValue: jest.fn(),
}))

function makeSummary(overrides: Partial<WealthSummary> = {}): WealthSummary {
  return {
    totalValue: 100_000,
    totalGainOnDay: 0,
    portfolioCount: 1,
    healthcareReserve: 0,
    classificationBreakdown: [],
    portfolioBreakdown: [{ code: "P1", name: "P1", value: 100_000 }],
    ...overrides,
  } as WealthSummary
}

// Build a holdings contract with `count` distinct asset positions, each worth
// a descending market value so the resulting allocation list is stable-ordered.
function makeHoldings(count: number): HoldingContract {
  const positions: Record<string, unknown> = {}
  for (let i = 0; i < count; i++) {
    const code = `AST${String(i).padStart(2, "0")}`
    positions[code] = {
      asset: {
        code,
        name: `Asset ${i}`,
        market: { code: "NASDAQ" },
      },
      moneyValues: {
        BASE: {
          currency: { code: "USD" },
          marketValue: (count - i) * 1000,
          gainOnDay: 0,
          irr: 0,
        },
      },
    }
  }
  return { positions } as unknown as HoldingContract
}

function renderCharts(holdings: HoldingContract): RenderResult {
  return render(
    <AssetAllocationCharts
      summary={makeSummary()}
      holdings={holdings}
      fxRates={{ USD: 1 }}
      displayCurrency={USD}
      collapsed={false}
      onToggle={() => {}}
    />,
  )
}

void React

describe("AssetAllocationCharts — paged asset list", () => {
  it("renders a pie (not a list) for 10 or fewer slices", () => {
    const { container } = renderCharts(makeHoldings(10))
    // recharts pie wrapper present; the paged list / paging are not rendered.
    expect(
      container.querySelector(".recharts-responsive-container"),
    ).toBeInTheDocument()
    expect(screen.queryByText("Asset 0")).toBeNull()
    expect(screen.queryByRole("button", { name: /Next/i })).toBeNull()
    expect(screen.queryByText(/of 10/)).toBeNull()
  })

  it("renders a paged list (no pie) when there are more than 10 assets", () => {
    const { container } = renderCharts(makeHoldings(15))
    expect(container.querySelector(".recharts-responsive-container")).toBeNull()
    // First page: assets 0..9 (descending value), asset 10 not yet shown.
    expect(screen.getByText("Asset 0")).toBeInTheDocument()
    expect(screen.getByText("Asset 9")).toBeInTheDocument()
    expect(screen.queryByText("Asset 10")).toBeNull()
    expect(screen.getByText(/1–10 of 15/)).toBeInTheDocument()
    // asset 0 = (15 - 0) * 1000 = 15,000; symbol + amount share one span.
    expect(screen.getByText("$15,000")).toBeInTheDocument()
  })

  it("pages to the remaining assets via Next", () => {
    renderCharts(makeHoldings(15))
    fireEvent.click(screen.getByRole("button", { name: /Next/i }))
    expect(screen.getByText("Asset 10")).toBeInTheDocument()
    expect(screen.getByText("Asset 14")).toBeInTheDocument()
    expect(screen.queryByText("Asset 0")).toBeNull()
    expect(screen.getByText(/11–15 of 15/)).toBeInTheDocument()
  })
})
