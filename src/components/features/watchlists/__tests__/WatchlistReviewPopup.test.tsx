import React from "react"
import { render, screen } from "@testing-library/react"
import WatchlistReviewPopup, {
  watchlistReviewKey,
} from "@components/features/watchlists/WatchlistReviewPopup"
import { clearAnalysisCache } from "@components/features/chat/useAnalysisChat"
import { sseAnswer, withUnsavedAnalyses } from "@test-fixtures/sse"

// react-markdown / remark-gfm are mocked globally in jest.setup.js.
// Shared Quick Analysis behaviour lives in features/chat/__tests__/AnalysisDialog.test.tsx.

const mockFetch = jest.fn()
global.fetch = withUnsavedAnalyses(mockFetch)

function body(): { query: string; context: Record<string, unknown> } {
  return JSON.parse(mockFetch.mock.calls[0][1].body as string)
}

describe("WatchlistReviewPopup", () => {
  beforeEach(() => {
    mockFetch.mockReset()
    clearAnalysisCache()
  })

  it("asks the agent for a momentum and fundamentals brief on the watchlist page", async () => {
    mockFetch.mockResolvedValueOnce(sseAnswer("Brief"))
    render(<WatchlistReviewPopup assetIds={["a1", "a2"]} onClose={jest.fn()} />)

    await screen.findByText("Brief")
    expect(mockFetch.mock.calls[0][0]).toBe("/api/agent/query/stream")
    const { query, context } = body()
    expect(context.page).toBe("Watchlist")
    expect(query).toMatch(/momentum/i)
    expect(query).toMatch(/fundamental/i)
  })

  it("leaves the watched assets for the agent to read itself", async () => {
    mockFetch.mockResolvedValueOnce(sseAnswer("Brief"))
    render(<WatchlistReviewPopup assetIds={["a1"]} onClose={jest.fn()} />)

    await screen.findByText("Brief")
    expect(JSON.stringify(body().context)).not.toContain("a1")
  })

  it("is titled AI Summary — Watchlist", async () => {
    mockFetch.mockResolvedValueOnce(sseAnswer("Brief"))
    render(<WatchlistReviewPopup assetIds={["a1"]} onClose={jest.fn()} />)

    expect(screen.getByText("AI Summary — Watchlist")).toBeInTheDocument()
    await screen.findByText("Brief")
  })

  it("keys the cached brief on the watched assets, in any order", () => {
    expect(watchlistReviewKey(["b", "a"])).toBe(watchlistReviewKey(["a", "b"]))
    expect(watchlistReviewKey(["a", "b"])).not.toBe(
      watchlistReviewKey(["a", "b", "c"]),
    )
  })
})
