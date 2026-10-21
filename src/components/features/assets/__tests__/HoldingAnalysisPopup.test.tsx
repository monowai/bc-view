import React from "react"
import { render, screen } from "@testing-library/react"
import HoldingAnalysisPopup from "../HoldingAnalysisPopup"
import { clearAnalysisCache } from "@components/features/chat/useAnalysisChat"
import { sseAnswer, sseResponse, withUnsavedAnalyses } from "@test-fixtures/sse"

const mockFetch = jest.fn()
global.fetch = withUnsavedAnalyses(mockFetch)

function bodyOf(call: number): Record<string, unknown> & {
  query: string
  label?: string
  context: Record<string, unknown>
} {
  return JSON.parse(mockFetch.mock.calls[call][1].body as string)
}

describe("HoldingAnalysisPopup", () => {
  beforeEach(() => {
    mockFetch.mockReset()
    clearAnalysisCache()
  })

  it("asks for a Holding Analysis of the asset in the portfolio, sending no holding numbers", async () => {
    mockFetch.mockResolvedValueOnce(sseAnswer("Your position"))
    render(
      <HoldingAnalysisPopup
        ticker="AAPL"
        market="NASDAQ"
        portfolioCode="PF"
        onClose={jest.fn()}
      />,
    )
    expect(await screen.findByText("Your position")).toBeInTheDocument()
    expect(mockFetch.mock.calls[0][0]).toBe("/api/agent/query/stream")
    const body = bodyOf(0)
    // The server fetches weight, cost and the rest; the client only names
    // the holding.
    expect(body.context).toEqual({
      page: "Holding Analysis",
      tickers: "AAPL",
      market: "NASDAQ",
      portfolioCode: "PF",
    })
    expect(body.query).toBe("")
  })

  it("titles the dialog as a Holding Analysis", async () => {
    mockFetch.mockResolvedValueOnce(sseAnswer("Your position"))
    render(
      <HoldingAnalysisPopup
        ticker="AAPL"
        market="NASDAQ"
        portfolioCode="PF"
        onClose={jest.fn()}
      />,
    )
    expect(screen.getByText("Holding Analysis — AAPL")).toBeInTheDocument()
    await screen.findByText("Your position")
  })

  it("explains a not-held answer in plain words", async () => {
    mockFetch.mockResolvedValueOnce(
      sseResponse([
        { event: "error", data: "not-held" },
        { event: "done", data: "{}" },
      ]),
    )
    render(
      <HoldingAnalysisPopup
        ticker="AAPL"
        market="NASDAQ"
        portfolioCode="PF"
        onClose={jest.fn()}
      />,
    )
    expect(
      await screen.findByText(/don't hold any of this asset/i),
    ).toBeInTheDocument()
    expect(screen.queryByText(/not-held/)).not.toBeInTheDocument()
  })
})
