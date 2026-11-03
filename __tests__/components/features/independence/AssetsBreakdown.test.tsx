import React from "react"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import "@testing-library/jest-dom"

let mockHide = false
jest.mock("@hooks/usePrivacyMode", () => ({
  usePrivacyMode: () => ({ hideValues: mockHide }),
}))
jest.mock("@components/features/independence", () => ({
  DEFAULT_NON_SPENDABLE_CATEGORIES: ["Property", "Real Estate"],
  INCOME_STREAM_CATEGORIES: ["Retirement Fund"],
}))

import AssetsBreakdown from "@components/features/independence/AssetsBreakdown"
import type { AllocationSlice } from "@lib/allocation/aggregateHoldings"
import type { CpfSubAccountRow } from "@lib/independence/cpfSubAccountTags"

const slice = (key: string, value: number): AllocationSlice => ({
  key,
  label: `${key} label`,
  value,
  percentage: 0,
  color: "#123456",
  gainOnDay: 0,
  irr: 0,
})

const row = (code: string, balance: number): CpfSubAccountRow => ({
  parentAssetId: "cpf1",
  parentAssetName: "CPF",
  code,
  displayName: `${code} account`,
  balance,
  liquid: false,
  tagLabel: "Tag",
  tagTone: "gray",
  tooltip: "Tip",
})

const onToggle = jest.fn()
const onRefresh = jest.fn()

function renderIt(
  over: Partial<React.ComponentProps<typeof AssetsBreakdown>> = {},
): void {
  render(
    <AssetsBreakdown
      categorySlices={[
        slice("Cash", 1000),
        slice("Equity", 2000),
        slice("Property", 5000),
        slice("Retirement Fund", 3000),
      ]}
      spendableCategories={["Cash"]}
      onToggleCategory={onToggle}
      pensionProjections={[]}
      totalAssets={11000}
      liquidAssets={3000}
      effectiveCurrency="S$"
      effectiveFxRate={2}
      isCalculating={false}
      holdingsLoaded
      usingManualAssets={false}
      isRefreshingHoldings={false}
      onRefreshHoldings={onRefresh}
      {...over}
    />,
  )
}

beforeEach(() => {
  jest.clearAllMocks()
  mockHide = false
})

describe("AssetsBreakdown", () => {
  it("shows a spinner until holdings load", () => {
    renderIt({ holdingsLoaded: false })
    expect(screen.getByText("Loading holdings...")).toBeInTheDocument()
  })

  it("shows an empty state with no categories", () => {
    renderIt({ categorySlices: [] })
    expect(screen.getByText("No holdings found")).toBeInTheDocument()
  })

  it("converts values at the display fx rate and splits spendable from non-spendable", () => {
    renderIt()
    expect(screen.getByText("S$2,000")).toBeInTheDocument() // Cash 1000 x 2
    expect(screen.getByText("S$4,000")).toBeInTheDocument() // Equity
    expect(screen.getByText("S$10,000")).toBeInTheDocument() // Property
    // Retirement Fund and the liquid total both come to 3000 x 2
    expect(screen.getAllByText("S$6,000")).toHaveLength(2)
    expect(screen.getByText("S$22,000")).toBeInTheDocument() // total
    expect(screen.getAllByText("Non-spendable")).toHaveLength(2)
    expect(
      screen.getByText(
        "FI uses spendable assets; illiquid assets add long-term security.",
      ),
    ).toBeInTheDocument()
  })

  it("toggles a category via its checkbox", async () => {
    renderIt()
    const boxes = screen.getAllByRole("checkbox")
    expect(boxes[0]).toBeChecked()
    expect(boxes[1]).not.toBeChecked()
    await userEvent.click(boxes[1])
    expect(onToggle).toHaveBeenCalledWith("Equity")
  })

  it("refreshes holdings, and disables the control while refreshing", async () => {
    renderIt()
    await userEvent.click(screen.getByTitle("Refresh holdings from portfolio"))
    expect(onRefresh).toHaveBeenCalled()
  })

  it("shows refreshing state", () => {
    renderIt({ isRefreshingHoldings: true })
    expect(screen.getByText("Refreshing...")).toBeInTheDocument()
    expect(screen.getByTitle("Refresh holdings from portfolio")).toBeDisabled()
  })

  it("explains manual assets and hides the refresh control", () => {
    renderIt({ usingManualAssets: true, holdingsLoaded: false })
    expect(
      screen.getByText(/manually entered asset values/),
    ).toBeInTheDocument()
    expect(
      screen.queryByTitle("Refresh holdings from portfolio"),
    ).not.toBeInTheDocument()
  })

  it("masks values when privacy mode is on", () => {
    mockHide = true
    renderIt({
      pensionProjections: [
        {
          assetId: "p",
          assetName: "Pension",
          currentValue: 100,
          projectedValue: 500,
          payoutAge: 65,
          currency: "SGD",
          category: "Policy",
          monthlyPayout: 50,
        },
      ],
    })
    expect(screen.queryByText("S$2,000")).not.toBeInTheDocument()
    expect(screen.queryByText("S$22,000")).not.toBeInTheDocument()
    expect(screen.queryByText("S$100/month")).not.toBeInTheDocument()
  })

  it("lists pension projections with payout details", () => {
    renderIt({
      pensionProjections: [
        {
          assetId: "p1",
          assetName: "Life Policy",
          currentValue: 100,
          projectedValue: 500,
          payoutAge: 65,
          currency: "SGD",
          category: "Policy",
          monthlyPayout: 50,
        },
        {
          assetId: "p2",
          assetName: "CPF LIFE",
          currentValue: 10,
          projectedValue: 20,
          payoutAge: 67,
          currency: "SGD",
          category: "CPF",
          cpfLifePlan: "ESCALATING",
        },
      ],
    })
    expect(screen.getByText("Payout at age 65")).toBeInTheDocument()
    expect(screen.getByText("S$100/month")).toBeInTheDocument()
    expect(
      screen.getByText("CPF LIFE (Escalating) from age 67"),
    ).toBeInTheDocument()
    expect(screen.getByText("S$1,000")).toBeInTheDocument() // projected 500 x 2
  })

  it("expands CPF sub-accounts under the parent category, hiding MediSave", async () => {
    renderIt({
      categorySlices: [slice("Retirement", 4000)],
      cpfSubAccountsByCategoryKey: {
        Retirement: [row("OA", 1000), row("MA", 700)],
      },
      totalAssets: 4000,
      liquidAssets: 4000,
    })
    expect(screen.queryByText("OA account")).not.toBeInTheDocument()
    await userEvent.click(screen.getByLabelText("Show breakdown"))
    expect(screen.getByText("OA account")).toBeInTheDocument()
    expect(screen.getByText("S$2,000")).toBeInTheDocument()
    expect(screen.queryByText("MA account")).not.toBeInTheDocument()
    await userEvent.click(screen.getByLabelText("Hide breakdown"))
    expect(screen.queryByText("OA account")).not.toBeInTheDocument()
  })

  it("surfaces the healthcare reserve under non-spendable", async () => {
    renderIt({
      cpfSubAccountsByCategoryKey: { Retirement: [row("MA", 700)] },
    })
    expect(screen.queryByText(/Healthcare Reserve/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByLabelText("Show non-spendable breakdown"))
    expect(screen.getByText(/Healthcare Reserve/)).toBeInTheDocument()
    expect(screen.getByText("S$1,400")).toBeInTheDocument()
    await userEvent.click(screen.getByLabelText("Hide non-spendable breakdown"))
    expect(screen.queryByText(/Healthcare Reserve/)).not.toBeInTheDocument()
  })

  it("omits the non-spendable line when everything is spendable", () => {
    renderIt({ totalAssets: 3000, liquidAssets: 3000 })
    expect(screen.queryByText("Non-Spendable")).not.toBeInTheDocument()
  })

  it("shows a calculating indicator", () => {
    renderIt({ isCalculating: true })
    expect(screen.getByText("Calculating projection...")).toBeInTheDocument()
  })
})
