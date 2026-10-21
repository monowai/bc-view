import React from "react"
import { render, screen } from "@testing-library/react"
import NewsSentimentPopup from "../NewsSentimentPopup"
import { clearAnalysisCache } from "@components/features/chat/useAnalysisChat"
import { sseAnswer, sseResponse, withUnsavedAnalyses } from "@test-fixtures/sse"

// react-markdown / remark-gfm are mocked globally in jest.setup.js.
// Shared Quick Analysis behaviour (follow-ups, Open in chat, failed runs not
// cached) lives in features/chat/__tests__/AnalysisDialog.test.tsx.

const mockFetch = jest.fn()
global.fetch = withUnsavedAnalyses(mockFetch)

function bodyOf(call: number): Record<string, unknown> & {
  query: string
  context: Record<string, unknown>
} {
  return JSON.parse(mockFetch.mock.calls[call][1].body as string)
}

describe("NewsSentimentPopup", () => {
  beforeEach(() => {
    mockFetch.mockReset()
    clearAnalysisCache()
  })

  it("renders with the ticker in the title", async () => {
    mockFetch.mockResolvedValueOnce(sseAnswer("Some news"))
    render(<NewsSentimentPopup ticker="AAPL" onClose={jest.fn()} />)
    expect(screen.getByText("News & Sentiment — AAPL")).toBeInTheDocument()
    await screen.findByText("Some news")
  })

  it("renders market code in the title when provided", async () => {
    mockFetch.mockResolvedValueOnce(sseAnswer("NZX news"))
    render(<NewsSentimentPopup ticker="GNE" market="NZX" onClose={jest.fn()} />)
    expect(screen.getByText("News & Sentiment — GNE")).toBeInTheDocument()
    expect(screen.getByText("(NZX)")).toBeInTheDocument()
    await screen.findByText("NZX news")
  })

  it("shows the news loading copy until the first token arrives", async () => {
    mockFetch.mockResolvedValueOnce(
      sseResponse(
        [
          { event: "token", data: "Fresh headlines" },
          { event: "done", data: "{}" },
        ],
        { delayMs: 20 },
      ),
    )
    render(<NewsSentimentPopup ticker="AAPL" onClose={jest.fn()} />)
    expect(await screen.findByText("Fetching news...")).toBeInTheDocument()
    expect(await screen.findByText("Fresh headlines")).toBeInTheDocument()
    expect(screen.queryByText("Fetching news...")).not.toBeInTheDocument()
  })

  it("streams the agent response as markdown", async () => {
    mockFetch.mockResolvedValueOnce(sseAnswer("AAPL is bullish today"))
    render(<NewsSentimentPopup ticker="AAPL" onClose={jest.fn()} />)
    expect(await screen.findByText("AAPL is bullish today")).toBeInTheDocument()
    expect(mockFetch.mock.calls[0][0]).toBe("/api/agent/query/stream")
  })

  it("asks for live news with a labelled general-knowledge fallback and no preamble", async () => {
    mockFetch.mockResolvedValueOnce(sseAnswer("Some news"))
    render(
      <NewsSentimentPopup
        ticker="AAPL"
        market="NASDAQ"
        assetName="Apple Inc."
        onClose={jest.fn()}
      />,
    )
    await screen.findByText("Some news")
    const body = bodyOf(0)
    expect(body.query).toContain(
      "Get news and sentiment for AAPL (Apple Inc.) listed on the NASDAQ exchange",
    )
    expect(body.query).toMatch(/general-knowledge summary/i)
    expect(body.query).toMatch(/no preamble/i)
    expect(body.context).toEqual({
      page: "News & Sentiment",
      description: "Quick news lookup for a single asset",
      tickers: "AAPL",
      market: "NASDAQ",
      assetName: "Apple Inc.",
    })
  })

  it("shows error on fetch failure", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, body: null })
    render(<NewsSentimentPopup ticker="AAPL" onClose={jest.fn()} />)
    expect(
      await screen.findByText(/an error occurred: HTTP 500/i),
    ).toBeInTheDocument()
  })

  it("explains an out-of-credit provider", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 402, body: null })
    render(<NewsSentimentPopup ticker="AAPL" onClose={jest.fn()} />)
    expect(await screen.findByText(/run out of credit/i)).toBeInTheDocument()
  })

  it("uses cached response for the same ticker", async () => {
    mockFetch.mockResolvedValueOnce(sseAnswer("Cached news"))
    const onClose = jest.fn()
    const { unmount } = render(
      <NewsSentimentPopup ticker="MSFT" onClose={onClose} />,
    )
    await screen.findByText("Cached news")
    unmount()

    render(<NewsSentimentPopup ticker="MSFT" onClose={onClose} />)
    expect(screen.getByText("Cached news")).toBeInTheDocument()
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("uses separate cache entries for same ticker on different markets", async () => {
    mockFetch
      .mockResolvedValueOnce(sseAnswer("US GNE news"))
      .mockResolvedValueOnce(sseAnswer("NZX GNE news"))
    const onClose = jest.fn()

    const { unmount } = render(
      <NewsSentimentPopup ticker="GNE" onClose={onClose} />,
    )
    await screen.findByText("US GNE news")
    unmount()

    render(<NewsSentimentPopup ticker="GNE" market="NZX" onClose={onClose} />)
    expect(await screen.findByText("NZX GNE news")).toBeInTheDocument()
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it("includes market in the fetch query", async () => {
    mockFetch.mockResolvedValueOnce(sseAnswer("NZX data"))
    render(<NewsSentimentPopup ticker="GNE" market="NZX" onClose={jest.fn()} />)
    await screen.findByText("NZX data")
    const body = bodyOf(0)
    expect(body.query).toContain("NZX")
    expect(body.context.market).toBe("NZX")
  })
})
