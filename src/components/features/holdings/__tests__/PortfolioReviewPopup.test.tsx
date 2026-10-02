import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import PortfolioReviewPopup from "@components/features/holdings/PortfolioReviewPopup"
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

describe("PortfolioReviewPopup", () => {
  beforeEach(() => {
    mockFetch.mockReset()
    clearAnalysisCache()
  })

  it("posts portfolio context to the streaming endpoint for a single portfolio", async () => {
    mockFetch.mockResolvedValueOnce(sseAnswer("Hi"))
    render(
      <PortfolioReviewPopup
        target={{
          kind: "portfolio",
          id: "p-123",
          code: "TEST",
          name: "Test Portfolio",
        }}
        onClose={jest.fn()}
      />,
    )
    await screen.findByText("Hi")
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe("/api/agent/query/stream")
    expect(init.headers.Accept).toBe("text/event-stream")
    expect(init.signal).toBeInstanceOf(AbortSignal)
    const body = bodyOf(0)
    expect(body.context.page).toBe("Portfolio Review")
    expect(body.context.portfolioId).toBe("p-123")
    expect(body.context.portfolioCode).toBe("TEST")
    expect(body.context.portfolioName).toBe("Test Portfolio")
    expect(body.query).toMatch(/financial columnist/i)
  })

  it("titles the dialog with the portfolio name", async () => {
    mockFetch.mockResolvedValueOnce(sseAnswer("Hi"))
    render(
      <PortfolioReviewPopup
        target={{
          kind: "portfolio",
          id: "p-123",
          code: "TEST",
          name: "Test Portfolio",
        }}
        onClose={jest.fn()}
      />,
    )
    expect(screen.getByText("AI Summary — Test Portfolio")).toBeInTheDocument()
    await screen.findByText("Hi")
  })

  it("briefing prompt classifies the book and gates XIRR on holding age", async () => {
    mockFetch.mockResolvedValueOnce(sseAnswer("Bond brief"))
    render(
      <PortfolioReviewPopup
        target={{
          kind: "portfolio",
          id: "p-bond",
          code: "BOND",
          name: "Bond Fund",
        }}
        onClose={jest.fn()}
      />,
    )
    await screen.findByText("Bond brief")
    const body = bodyOf(0)
    // Same prompt for every portfolio — the model must work out whether it
    // is looking at an equity, fixed-income, mixed, or cash book and pick the
    // matching vocabulary and yardstick, rather than assuming stocks.
    expect(body.query).toMatch(/classify the book/i)
    expect(body.query).toMatch(/fixed-income book/i)
    expect(body.query).toMatch(/within the mandate/i)
    // XIRR is annualised; young holdings must not be read as a long arc.
    expect(body.query).toMatch(/6 months/i)
    expect(body.query).toMatch(/annualisation noise/i)
    // Multi-week macro moves are backdrop, never a same-day cause.
    expect(body.query).toMatch(/match windows/i)
    // No duration/credit data exists — inferences must be labelled.
    expect(body.query).toMatch(/NO duration/)
  })

  it("posts portfolioCodes for an aggregated target and titles it by count", async () => {
    mockFetch.mockResolvedValueOnce(sseAnswer("Aggregate brief"))
    render(
      <PortfolioReviewPopup
        target={{ kind: "aggregated", codes: ["A", "B"] }}
        onClose={jest.fn()}
      />,
    )
    await screen.findByText("Aggregate brief")
    const body = bodyOf(0)
    expect(body.context.page).toBe("Portfolio Review")
    expect(body.context.portfolioCodes).toEqual(["A", "B"])
    expect(body.context.portfolioId).toBeUndefined()
    expect(
      screen.getByText("AI Summary — Aggregated — 2 portfolios"),
    ).toBeInTheDocument()
  })

  it("renders streamed token chunks as they arrive", async () => {
    mockFetch.mockResolvedValueOnce(
      sseResponse([
        { event: "token", data: "Headwinds:" },
        { event: "token", data: " rates" },
        { event: "done", data: "{}" },
      ]),
    )
    render(
      <PortfolioReviewPopup
        target={{ kind: "portfolio", id: "p-1", code: "X", name: "X" }}
        onClose={jest.fn()}
      />,
    )
    expect(await screen.findByText("Headwinds: rates")).toBeInTheDocument()
  })

  it("shows the summary loading copy and a Cancel button that aborts the stream", async () => {
    mockFetch.mockImplementationOnce(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener("abort", () => {
            const err = new Error("Aborted")
            err.name = "AbortError"
            reject(err)
          })
        }),
    )
    render(
      <PortfolioReviewPopup
        target={{ kind: "portfolio", id: "p-1", code: "X", name: "X" }}
        onClose={jest.fn()}
      />,
    )
    expect(await screen.findByText("Generating summary...")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }))
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [, init] = mockFetch.mock.calls[0]
    expect((init.signal as AbortSignal).aborted).toBe(true)
    // Cancel resets isLoading so the Cancel button disappears.
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /cancel/i }),
      ).not.toBeInTheDocument(),
    )
    expect(screen.queryByText("Generating summary...")).not.toBeInTheDocument()
  })

  it("surfaces stream-level error events", async () => {
    mockFetch.mockResolvedValueOnce(
      sseResponse([
        { event: "error", data: "provider-quota" },
        { event: "done", data: "{}" },
      ]),
    )
    render(
      <PortfolioReviewPopup
        target={{ kind: "portfolio", id: "p-1", code: "X", name: "X" }}
        onClose={jest.fn()}
      />,
    )
    expect(
      await screen.findByText(/AI features are paused/i),
    ).toBeInTheDocument()
    expect(screen.getByText(/run out of credit/i)).toBeInTheDocument()
  })

  it("parses SSE frames using \\r\\n\\r\\n separators (proxy-normalised line endings)", async () => {
    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(encoder.encode("event:token\r\ndata:Hi\r\n\r\n"))
        c.enqueue(encoder.encode("event:token\r\ndata: there\r\n\r\n"))
        c.enqueue(encoder.encode("event:done\r\ndata:{}\r\n\r\n"))
        c.close()
      },
    })
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, body })
    render(
      <PortfolioReviewPopup
        target={{ kind: "portfolio", id: "p-1", code: "X", name: "X" }}
        onClose={jest.fn()}
      />,
    )
    await waitFor(() =>
      expect(screen.getByTestId("markdown").textContent).toBe("Hi there"),
    )
  })

  it("caches by target so reopening the same portfolio does not re-fetch", async () => {
    mockFetch.mockResolvedValueOnce(sseAnswer("Cached"))
    const target = {
      kind: "portfolio" as const,
      id: "p-1",
      code: "X",
      name: "X",
    }
    const { unmount } = render(
      <PortfolioReviewPopup target={target} onClose={jest.fn()} />,
    )
    await screen.findByText("Cached")
    unmount()
    render(<PortfolioReviewPopup target={target} onClose={jest.fn()} />)
    expect(screen.getByText("Cached")).toBeInTheDocument()
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("re-fetches for a different portfolio", async () => {
    mockFetch
      .mockResolvedValueOnce(sseAnswer("First brief"))
      .mockResolvedValueOnce(sseAnswer("Second brief"))
    const { unmount } = render(
      <PortfolioReviewPopup
        target={{ kind: "portfolio", id: "p-1", code: "X", name: "X" }}
        onClose={jest.fn()}
      />,
    )
    await screen.findByText("First brief")
    unmount()
    render(
      <PortfolioReviewPopup
        target={{ kind: "portfolio", id: "p-2", code: "Y", name: "Y" }}
        onClose={jest.fn()}
      />,
    )
    expect(await screen.findByText("Second brief")).toBeInTheDocument()
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(bodyOf(1).context.portfolioId).toBe("p-2")
  })

  it("reuses an aggregated briefing regardless of portfolio code order", async () => {
    mockFetch.mockResolvedValueOnce(sseAnswer("Aggregate brief"))
    const { unmount } = render(
      <PortfolioReviewPopup
        target={{ kind: "aggregated", codes: ["A", "B"] }}
        onClose={jest.fn()}
      />,
    )
    await screen.findByText("Aggregate brief")
    unmount()
    render(
      <PortfolioReviewPopup
        target={{ kind: "aggregated", codes: ["B", "A"] }}
        onClose={jest.fn()}
      />,
    )
    expect(screen.getByText("Aggregate brief")).toBeInTheDocument()
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("discards narration after a reset, and caches only the post-reset text", async () => {
    const encoder = new TextEncoder()
    const streamBytes = (): ReadableStream<Uint8Array> =>
      new ReadableStream<Uint8Array>({
        start(c) {
          c.enqueue(
            encoder.encode("event:token\ndata:I'll gather the data…\n\n"),
          )
          c.enqueue(encoder.encode("event:reset\ndata:\n\n"))
          c.enqueue(
            encoder.encode(
              "event:token\ndata:# Summary\ndata:Real content\n\n",
            ),
          )
          c.enqueue(encoder.encode("event:done\ndata:{}\n\n"))
          c.close()
        },
      })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: streamBytes(),
    })
    const target = {
      kind: "portfolio" as const,
      id: "p-reset",
      code: "R",
      name: "R",
    }
    const { unmount } = render(
      <PortfolioReviewPopup target={target} onClose={jest.fn()} />,
    )
    await waitFor(() =>
      expect(screen.getByTestId("markdown").textContent).toBe(
        "# Summary\nReal content",
      ),
    )
    expect(screen.getByTestId("markdown").textContent).not.toContain(
      "gather the data",
    )

    // Reopening the same target renders from cache — the cached text must be
    // the post-reset content only.
    unmount()
    render(<PortfolioReviewPopup target={target} onClose={jest.fn()} />)
    expect(screen.getByTestId("markdown").textContent).toBe(
      "# Summary\nReal content",
    )
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
