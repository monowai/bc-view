import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import PortfolioReviewPopup, {
  clearPortfolioReviewCache,
} from "@components/features/holdings/PortfolioReviewPopup"

// react-markdown / remark-gfm are mocked globally in jest.setup.js

const mockFetch = jest.fn()
global.fetch = mockFetch

// Build a Response-shaped object whose body is a ReadableStream of SSE events.
function sseResponse(
  events: Array<{ event: string; data: string }>,
  opts: { delayMs?: number } = {},
): { ok: true; status: number; body: ReadableStream<Uint8Array> } {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const e of events) {
        if (opts.delayMs) {
          await new Promise((r) => setTimeout(r, opts.delayMs))
        }
        controller.enqueue(
          encoder.encode(`event:${e.event}\ndata:${e.data}\n\n`),
        )
      }
      controller.close()
    },
  })
  return { ok: true, status: 200, body }
}

describe("PortfolioReviewPopup", () => {
  beforeEach(() => {
    mockFetch.mockReset()
    clearPortfolioReviewCache()
  })

  it("posts portfolio context to the streaming endpoint for a single portfolio", async () => {
    mockFetch.mockResolvedValueOnce(
      sseResponse([
        { event: "token", data: "Hi" },
        { event: "done", data: "{}" },
      ]),
    )
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
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe("/api/agent/query/stream")
    expect(init.headers.Accept).toBe("text/event-stream")
    expect(init.signal).toBeInstanceOf(AbortSignal)
    const body = JSON.parse(init.body)
    expect(body.context.page).toBe("Portfolio Review")
    expect(body.context.portfolioId).toBe("p-123")
    expect(body.context.portfolioCode).toBe("TEST")
    expect(body.context.portfolioName).toBe("Test Portfolio")
    expect(body.query).toMatch(/financial columnist/i)
  })

  it("posts portfolioCodes for an aggregated target", async () => {
    mockFetch.mockResolvedValueOnce(
      sseResponse([{ event: "done", data: "{}" }]),
    )
    render(
      <PortfolioReviewPopup
        target={{ kind: "aggregated", codes: ["A", "B"] }}
        onClose={jest.fn()}
      />,
    )
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.context.portfolioCodes).toEqual(["A", "B"])
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
    await waitFor(() =>
      expect(screen.getByText("Headwinds: rates")).toBeInTheDocument(),
    )
  })

  it("shows a Cancel button while loading and aborts the stream when clicked", async () => {
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
    const cancelBtn = await screen.findByRole("button", {
      name: /cancel summary generation/i,
    })
    await userEvent.click(cancelBtn)
    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [, init] = mockFetch.mock.calls[0]
    expect((init.signal as AbortSignal).aborted).toBe(true)
    // Cancel resets isLoading so the Cancel button disappears immediately.
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: /cancel summary generation/i }),
      ).not.toBeInTheDocument(),
    )
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
    await waitFor(() => expect(screen.getByText(/error/i)).toBeInTheDocument())
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
      expect(screen.getByText("Hi there")).toBeInTheDocument(),
    )
  })

  it("caches by target so reopening the same portfolio does not re-fetch", async () => {
    mockFetch.mockResolvedValueOnce(
      sseResponse([
        { event: "token", data: "Cached" },
        { event: "done", data: "{}" },
      ]),
    )
    const target = {
      kind: "portfolio" as const,
      id: "p-1",
      code: "X",
      name: "X",
    }
    const { unmount } = render(
      <PortfolioReviewPopup target={target} onClose={jest.fn()} />,
    )
    await waitFor(() => expect(screen.getByText("Cached")).toBeInTheDocument())
    unmount()
    render(<PortfolioReviewPopup target={target} onClose={jest.fn()} />)
    await waitFor(() =>
      expect(screen.getAllByText("Cached")[0]).toBeInTheDocument(),
    )
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
