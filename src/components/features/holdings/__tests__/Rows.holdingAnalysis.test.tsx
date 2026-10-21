import React from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import Rows from "../Rows"
import { ValueIn } from "@components/features/holdings/GroupByOptions"
import type { Asset, PortfolioBreakdown } from "types/beancounter"
import { clearAnalysisCache } from "@components/features/chat/useAnalysisChat"
import { sseAnswer, withUnsavedAnalyses } from "@test-fixtures/sse"
import {
  makeAsset,
  makeCashAsset,
  makeHoldingGroup,
  makePortfolio,
  makePortfolioBreakdown,
  makePosition,
} from "@test-fixtures/beancounter"

jest.mock("@components/ui/ProgressBar", () => ({
  AlphaProgress: () => <div data-testid="alpha-progress" />,
}))

const mockFetch = jest.fn()
global.fetch = withUnsavedAnalyses(mockFetch)

const portfolio = makePortfolio({ id: "pf-rows", code: "PAGE" })

function renderRow(
  asset: Asset,
  opts: { quantity?: number; breakdown?: PortfolioBreakdown[] } = {},
): ReturnType<typeof render> {
  const position = makePosition({
    asset,
    moneyValues: { weight: 0.25 },
    price: 150,
    quantityValues: { total: opts.quantity ?? 100 },
    overrides: opts.breakdown ? { portfolioBreakdown: opts.breakdown } : {},
  })
  return render(
    <table>
      <Rows
        portfolio={portfolio}
        groupBy="Equity"
        holdingGroup={makeHoldingGroup({ positions: [position] })}
        valueIn={ValueIn.PORTFOLIO}
        onColumnsChange={jest.fn()}
        onTrade={jest.fn()}
      />
    </table>,
  )
}

const openMenu = (code: string): void => {
  fireEvent.click(screen.getByRole("button", { name: `Actions ${code}` }))
}

const analyseItem = (): HTMLElement | null =>
  screen.queryByRole("button", { name: "Analyse my holding" })

describe("Rows holding analysis", () => {
  beforeEach(() => {
    mockFetch.mockReset()
    clearAnalysisCache()
  })

  it("opens a Holding Analysis for a held, news-capable asset with a blank query and no holding numbers", async () => {
    mockFetch.mockResolvedValueOnce(sseAnswer("Your position"))
    renderRow(makeAsset())
    openMenu("AAPL")
    fireEvent.click(analyseItem()!)

    expect(await screen.findByText("Your position")).toBeInTheDocument()
    expect(screen.getByText("Holding Analysis — AAPL")).toBeInTheDocument()
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    expect(body.query).toBe("")
    expect(body.context).toEqual({
      page: "Holding Analysis",
      tickers: "AAPL",
      market: "NASDAQ",
      portfolioCode: "PAGE",
    })
  })

  it("is not offered when the asset has no news", () => {
    renderRow(makeAsset({ hasNews: false }))
    openMenu("AAPL")
    expect(analyseItem()).not.toBeInTheDocument()
  })

  it("is not offered for an unchartable asset", () => {
    renderRow(makeAsset({ chartable: false }))
    openMenu("AAPL")
    expect(analyseItem()).not.toBeInTheDocument()
  })

  it("is not offered for a position no longer held", () => {
    renderRow(makeAsset(), { quantity: 0 })
    openMenu("AAPL")
    expect(analyseItem()).not.toBeInTheDocument()
  })

  it("is not offered for cash", () => {
    renderRow(makeCashAsset())
    expect(analyseItem()).not.toBeInTheDocument()
  })

  it("analyses an aggregated row in the one portfolio that holds it", async () => {
    mockFetch.mockResolvedValueOnce(sseAnswer("Your position"))
    renderRow(makeAsset(), {
      breakdown: [makePortfolioBreakdown({ portfolioCode: "SOURCE" })],
    })
    openMenu("AAPL")
    fireEvent.click(analyseItem()!)
    await screen.findByText("Your position")
    const body = JSON.parse(mockFetch.mock.calls[0][1].body as string)
    expect(body.context.portfolioCode).toBe("SOURCE")
  })

  it("is not offered for an aggregated row held in several portfolios", () => {
    renderRow(makeAsset(), {
      breakdown: [
        makePortfolioBreakdown({ portfolioCode: "ONE" }),
        makePortfolioBreakdown({ portfolioCode: "TWO" }),
      ],
    })
    openMenu("AAPL")
    expect(analyseItem()).not.toBeInTheDocument()
  })
})
