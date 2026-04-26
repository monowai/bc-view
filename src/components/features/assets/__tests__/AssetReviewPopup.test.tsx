import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import AssetReviewPopup, { clearReviewCache } from "../AssetReviewPopup"

// react-markdown / remark-gfm are mocked globally in jest.setup.js

const mockFetch = jest.fn()
global.fetch = mockFetch

describe("AssetReviewPopup", () => {
  beforeEach(() => {
    mockFetch.mockReset()
    clearReviewCache()
  })

  it("posts to /api/agent/query with page=Asset Review so the backend selectors route to the right prompt and tools", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          response: "Bullish",
          timestamp: "2026-04-26T00:00:00Z",
        }),
    })
    render(
      <AssetReviewPopup
        ticker="AAPL"
        market="NASDAQ"
        assetName="Apple Inc."
        onClose={jest.fn()}
      />,
    )
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1))
    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe("/api/agent/query")
    const body = JSON.parse(init.body)
    expect(body.context.page).toBe("Asset Review")
    expect(body.context.tickers).toBe("AAPL")
    expect(body.context.market).toBe("NASDAQ")
    expect(body.context.assetName).toBe("Apple Inc.")
    expect(body.query).toContain("AAPL")
  })

  it("renders the agent response as markdown", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          response: "AAPL looks strong",
          timestamp: "2026-04-26T00:00:00Z",
        }),
    })
    render(<AssetReviewPopup ticker="AAPL" onClose={jest.fn()} />)
    await waitFor(() =>
      expect(screen.getByText("AAPL looks strong")).toBeInTheDocument(),
    )
  })

  it("shows error on fetch failure", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ message: "Server error" }),
    })
    render(<AssetReviewPopup ticker="AAPL" onClose={jest.fn()} />)
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument()
    })
  })
})
