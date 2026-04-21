import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import NewsSentimentPopup, { clearNewsCache } from "../NewsSentimentPopup"

jest.mock("react-markdown", () => {
  return function MockMarkdown({ children }: { children: string }) {
    return <div data-testid="markdown">{children}</div>
  }
})
jest.mock("remark-gfm", () => () => {})

const mockFetch = jest.fn()
global.fetch = mockFetch

describe("NewsSentimentPopup", () => {
  beforeEach(() => {
    mockFetch.mockReset()
    clearNewsCache()
  })

  // These tests cover sync render output, but the component kicks off an
  // async fetch inside useEffect — `findBy*` waits for the resolved state
  // so the setState lands inside act() and no warning fires.
  it("renders with the ticker in the title", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          response: "Some news",
          timestamp: "2026-04-15T00:00:00Z",
        }),
    })
    render(<NewsSentimentPopup ticker="AAPL" onClose={jest.fn()} />)
    expect(await screen.findByText(/AAPL/)).toBeInTheDocument()
  })

  it("renders market code in the title when provided", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          response: "NZX news",
          timestamp: "2026-04-15T00:00:00Z",
        }),
    })
    render(<NewsSentimentPopup ticker="GNE" market="NZX" onClose={jest.fn()} />)
    expect(await screen.findByText(/GNE/)).toBeInTheDocument()
    expect(screen.getByText("(NZX)")).toBeInTheDocument()
  })

  it("shows loading spinner while fetching", async () => {
    mockFetch.mockReturnValue(new Promise(() => {})) // never resolves
    render(<NewsSentimentPopup ticker="AAPL" onClose={jest.fn()} />)
    expect(await screen.findByText("Fetching news...")).toBeInTheDocument()
  })

  it("renders the agent response as markdown", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          response: "AAPL is bullish today",
          timestamp: "2026-04-15T00:00:00Z",
        }),
    })
    render(<NewsSentimentPopup ticker="AAPL" onClose={jest.fn()} />)
    await waitFor(() => {
      expect(screen.getByText("AAPL is bullish today")).toBeInTheDocument()
    })
  })

  it("shows error on fetch failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ message: "Server error" }),
    })
    render(<NewsSentimentPopup ticker="AAPL" onClose={jest.fn()} />)
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument()
    })
  })

  it("uses cached response for the same ticker", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          response: "Cached news",
          timestamp: "2026-04-15T00:00:00Z",
        }),
    })
    const onClose = jest.fn()
    const { unmount } = render(
      <NewsSentimentPopup ticker="MSFT" onClose={onClose} />,
    )
    await waitFor(() => {
      expect(screen.getByText("Cached news")).toBeInTheDocument()
    })
    expect(mockFetch).toHaveBeenCalledTimes(1)
    unmount()

    // Re-render with same ticker — should use cache
    render(<NewsSentimentPopup ticker="MSFT" onClose={onClose} />)
    await waitFor(() => {
      expect(screen.getByText("Cached news")).toBeInTheDocument()
    })
    // Still only 1 fetch call
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it("uses separate cache entries for same ticker on different markets", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            response: "US GNE news",
            timestamp: "2026-04-15T00:00:00Z",
          }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            response: "NZX GNE news",
            timestamp: "2026-04-15T00:00:00Z",
          }),
      })
    const onClose = jest.fn()

    const { unmount } = render(
      <NewsSentimentPopup ticker="GNE" onClose={onClose} />,
    )
    await waitFor(() => {
      expect(screen.getByText("US GNE news")).toBeInTheDocument()
    })
    unmount()

    render(<NewsSentimentPopup ticker="GNE" market="NZX" onClose={onClose} />)
    await waitFor(() => {
      expect(screen.getByText("NZX GNE news")).toBeInTheDocument()
    })
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it("includes market in the fetch query", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          response: "NZX data",
          timestamp: "2026-04-15T00:00:00Z",
        }),
    })
    render(<NewsSentimentPopup ticker="GNE" market="NZX" onClose={jest.fn()} />)
    await waitFor(() => {
      expect(screen.getByText("NZX data")).toBeInTheDocument()
    })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.query).toContain("NZX")
    expect(body.context.market).toBe("NZX")
  })
})
