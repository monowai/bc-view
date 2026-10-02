import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import AssetReviewPopup from "../AssetReviewPopup"
import { clearAnalysisCache } from "@components/features/chat/useAnalysisChat"
import { sseAnswer, sseResponse } from "@test-fixtures/sse"

// react-markdown / remark-gfm are mocked globally in jest.setup.js.
// Shared Quick Analysis behaviour (follow-ups, Open in chat, failed runs not
// cached) lives in features/chat/__tests__/AnalysisDialog.test.tsx.

const mockFetch = jest.fn()
global.fetch = mockFetch

function bodyOf(call: number): Record<string, unknown> & {
  query: string
  context: Record<string, unknown>
} {
  return JSON.parse(mockFetch.mock.calls[call][1].body as string)
}

describe("AssetReviewPopup", () => {
  beforeEach(() => {
    mockFetch.mockReset()
    clearAnalysisCache()
  })

  it("streams with page=Asset Review so the backend selectors route to the right prompt and tools", async () => {
    mockFetch.mockResolvedValueOnce(sseAnswer("Bullish"))
    render(
      <AssetReviewPopup
        ticker="AAPL"
        market="NASDAQ"
        assetName="Apple Inc."
        onClose={jest.fn()}
      />,
    )
    expect(await screen.findByText("Bullish")).toBeInTheDocument()
    expect(mockFetch).toHaveBeenCalledTimes(1)
    expect(mockFetch.mock.calls[0][0]).toBe("/api/agent/query/stream")
    const body = bodyOf(0)
    expect(body.context).toEqual({
      page: "Asset Review",
      description: "Single-asset deep dive from the assets/lookup screen",
      tickers: "AAPL",
      market: "NASDAQ",
      assetName: "Apple Inc.",
    })
    expect(body.query).toContain("Asset Review for AAPL (Apple Inc.)")
    expect(body.query).toContain("listed on NASDAQ")
    expect(body.query).toMatch(/corporate-action history/i)
    expect(body.query).toMatch(/do not assume the user holds it/i)
  })

  it("sends empty market and name when neither is known", async () => {
    mockFetch.mockResolvedValueOnce(sseAnswer("Bullish"))
    render(<AssetReviewPopup ticker="AAPL" onClose={jest.fn()} />)
    await screen.findByText("Bullish")
    const body = bodyOf(0)
    expect(body.context.market).toBe("")
    expect(body.context.assetName).toBe("")
    expect(body.query).not.toContain("listed on")
  })

  it("titles the dialog with the ticker and market", async () => {
    mockFetch.mockResolvedValueOnce(sseAnswer("Bullish"))
    render(
      <AssetReviewPopup ticker="AAPL" market="NASDAQ" onClose={jest.fn()} />,
    )
    expect(screen.getByText("Asset Review — AAPL")).toBeInTheDocument()
    expect(screen.getByText("(NASDAQ)")).toBeInTheDocument()
    await screen.findByText("Bullish")
  })

  it("shows the review loading copy until the first token arrives", async () => {
    mockFetch.mockResolvedValueOnce(
      sseResponse(
        [
          { event: "token", data: "AAPL looks strong" },
          { event: "done", data: "{}" },
        ],
        { delayMs: 20 },
      ),
    )
    render(<AssetReviewPopup ticker="AAPL" onClose={jest.fn()} />)
    expect(await screen.findByText("Generating review...")).toBeInTheDocument()
    expect(await screen.findByText("AAPL looks strong")).toBeInTheDocument()
    expect(screen.queryByText("Generating review...")).not.toBeInTheDocument()
  })

  it("names an out-of-credit provider as an administration issue, not a failed request", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 402, body: null })
    render(<AssetReviewPopup ticker="AAPL" onClose={jest.fn()} />)

    expect(
      await screen.findByText(/AI features are paused/i),
    ).toBeInTheDocument()
    const alert = screen.getByText(/run out of credit/i)
    // Reads as DESIGN.md's warning variant, not the red error alert that
    // tells the user their own request was wrong.
    expect(alert.closest("div")).toHaveClass("bg-yellow-50")
    expect(screen.queryByText(/HTTP 402/)).not.toBeInTheDocument()
  })

  it("explains a provider-quota error raised mid-stream", async () => {
    mockFetch.mockResolvedValueOnce(
      sseResponse([
        { event: "error", data: "provider-quota" },
        { event: "done", data: "{}" },
      ]),
    )
    render(<AssetReviewPopup ticker="AAPL" onClose={jest.fn()} />)
    expect(await screen.findByText(/run out of credit/i)).toBeInTheDocument()
  })

  it("shows an error on an unclassified fetch failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, body: null })
    render(<AssetReviewPopup ticker="AAPL" onClose={jest.fn()} />)
    expect(
      await screen.findByText(/an error occurred: HTTP 500/i),
    ).toBeInTheDocument()
  })

  it("reuses the review for the same ticker and market, but re-fetches for another market", async () => {
    mockFetch
      .mockResolvedValueOnce(sseAnswer("US review"))
      .mockResolvedValueOnce(sseAnswer("LSE review"))
    const first = render(
      <AssetReviewPopup ticker="AAPL" market="US" onClose={jest.fn()} />,
    )
    await screen.findByText("US review")
    first.unmount()

    const second = render(
      <AssetReviewPopup ticker="AAPL" market="US" onClose={jest.fn()} />,
    )
    expect(screen.getByText("US review")).toBeInTheDocument()
    expect(mockFetch).toHaveBeenCalledTimes(1)
    second.unmount()

    render(<AssetReviewPopup ticker="AAPL" market="LSE" onClose={jest.fn()} />)
    expect(await screen.findByText("LSE review")).toBeInTheDocument()
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2))
    expect(bodyOf(1).context.market).toBe("LSE")
  })
})
