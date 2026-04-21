import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import PortfolioAIOverview, { clearOverviewCache } from "../PortfolioAIOverview"
import { Portfolio } from "types/beancounter"

jest.mock("react-markdown", () => {
  return function MockMarkdown({ children }: { children: string }) {
    return <div data-testid="markdown">{children}</div>
  }
})
jest.mock("remark-gfm", () => () => {})

const mockFetch = jest.fn()
global.fetch = mockFetch

const usd = { code: "USD", name: "US Dollar", symbol: "$" }

const basePortfolio: Portfolio = {
  id: "p1",
  code: "TEST",
  name: "Test Portfolio",
  currency: usd,
  base: usd,
  marketValue: 100_000,
  irr: 0.12,
  gainOnDay: 1_250,
}

interface MockResponse {
  ok: boolean
  status?: number
  json: () => Promise<unknown>
}

function holdingsResponse(): MockResponse {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        holdingGroups: {
          EQUITY: {
            positions: [
              {
                asset: {
                  code: "AAPL",
                  name: "Apple",
                  market: { code: "NASDAQ" },
                  sector: "Technology",
                },
                moneyValues: {
                  PORTFOLIO: {
                    marketValue: 50000,
                    gainOnDay: 500,
                    weight: 0.5,
                  },
                },
              },
              {
                asset: {
                  code: "MSFT",
                  name: "Microsoft",
                  market: { code: "NASDAQ" },
                  sector: "Technology",
                },
                moneyValues: {
                  PORTFOLIO: {
                    marketValue: 30000,
                    gainOnDay: -100,
                    weight: 0.3,
                  },
                },
              },
            ],
          },
        },
      }),
  }
}

function agentResponse(text: string): MockResponse {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        query: "",
        response: text,
        timestamp: "2026-04-21T00:00:00Z",
        error: null,
      }),
  }
}

describe("PortfolioAIOverview", () => {
  beforeEach(() => {
    mockFetch.mockReset()
    clearOverviewCache()
  })

  it("renders a header with the portfolio code", async () => {
    mockFetch
      .mockResolvedValueOnce(holdingsResponse())
      .mockResolvedValueOnce(agentResponse("Some overview"))

    render(<PortfolioAIOverview portfolio={basePortfolio} />)
    expect(await screen.findByText(/AI Overview — TEST/)).toBeInTheDocument()
  })

  it("shows loading spinner while fetching", async () => {
    mockFetch.mockReturnValue(new Promise(() => {})) // never resolves
    render(<PortfolioAIOverview portfolio={basePortfolio} />)
    expect(await screen.findByText(/Analysing portfolio/)).toBeInTheDocument()
  })

  it("renders the agent response as markdown", async () => {
    mockFetch
      .mockResolvedValueOnce(holdingsResponse())
      .mockResolvedValueOnce(agentResponse("Portfolio looks strong"))
    render(<PortfolioAIOverview portfolio={basePortfolio} />)
    await waitFor(() => {
      expect(screen.getByText("Portfolio looks strong")).toBeInTheDocument()
    })
  })

  it("shows error when agent call fails", async () => {
    mockFetch.mockResolvedValueOnce(holdingsResponse()).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ message: "Server error" }),
    })
    render(<PortfolioAIOverview portfolio={basePortfolio} />)
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument()
    })
  })

  it("proceeds when holdings fetch fails (uses portfolio-level info only)", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce(agentResponse("Overview without holdings"))
    render(<PortfolioAIOverview portfolio={basePortfolio} />)
    await waitFor(() => {
      expect(screen.getByText("Overview without holdings")).toBeInTheDocument()
    })
    const agentBody = JSON.parse(mockFetch.mock.calls[1][1].body)
    expect(agentBody.context.topHoldings).toEqual([])
  })

  it("reuses cached response on second mount for the same portfolio", async () => {
    mockFetch
      .mockResolvedValueOnce(holdingsResponse())
      .mockResolvedValueOnce(agentResponse("Cached overview"))
    const { unmount } = render(
      <PortfolioAIOverview portfolio={basePortfolio} />,
    )
    await waitFor(() => {
      expect(screen.getByText("Cached overview")).toBeInTheDocument()
    })
    expect(mockFetch).toHaveBeenCalledTimes(2)
    unmount()

    render(<PortfolioAIOverview portfolio={basePortfolio} />)
    await waitFor(() => {
      expect(screen.getByText("Cached overview")).toBeInTheDocument()
    })
    // No additional fetches on second mount
    expect(mockFetch).toHaveBeenCalledTimes(2)
  })

  it("keeps separate cache entries for different portfolio codes", async () => {
    mockFetch
      .mockResolvedValueOnce(holdingsResponse())
      .mockResolvedValueOnce(agentResponse("Overview for TEST"))
      .mockResolvedValueOnce(holdingsResponse())
      .mockResolvedValueOnce(agentResponse("Overview for OTHER"))

    const { unmount } = render(
      <PortfolioAIOverview portfolio={basePortfolio} />,
    )
    await waitFor(() => {
      expect(screen.getByText("Overview for TEST")).toBeInTheDocument()
    })
    unmount()

    render(
      <PortfolioAIOverview portfolio={{ ...basePortfolio, code: "OTHER" }} />,
    )
    await waitFor(() => {
      expect(screen.getByText("Overview for OTHER")).toBeInTheDocument()
    })
    expect(mockFetch).toHaveBeenCalledTimes(4)
  })

  it("sends top holdings ordered by market value to the agent", async () => {
    mockFetch
      .mockResolvedValueOnce(holdingsResponse())
      .mockResolvedValueOnce(agentResponse("Ranked overview"))
    render(<PortfolioAIOverview portfolio={basePortfolio} />)
    await waitFor(() => {
      expect(screen.getByText("Ranked overview")).toBeInTheDocument()
    })
    const agentCall = mockFetch.mock.calls[1]
    expect(agentCall[0]).toBe("/api/agent/query")
    const body = JSON.parse(agentCall[1].body)
    expect(body.context.portfolioCode).toBe("TEST")
    expect(body.context.topHoldings[0].code).toBe("AAPL")
    expect(body.context.topHoldings[1].code).toBe("MSFT")
    expect(body.query).toContain("TEST")
    expect(body.query).toContain("AAPL")
  })

  it("caps the prompt at 10 holdings", async () => {
    const manyPositions = Array.from({ length: 15 }, (_, i) => ({
      asset: {
        code: `SYM${i}`,
        name: `Symbol ${i}`,
        market: { code: "NASDAQ" },
        sector: "Technology",
      },
      moneyValues: {
        PORTFOLIO: {
          marketValue: 1000 * (15 - i),
          gainOnDay: 10,
          weight: 0.05,
        },
      },
    }))
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            holdingGroups: { EQUITY: { positions: manyPositions } },
          }),
      })
      .mockResolvedValueOnce(agentResponse("Top 10 overview"))
    render(<PortfolioAIOverview portfolio={basePortfolio} />)
    await waitFor(() => {
      expect(screen.getByText("Top 10 overview")).toBeInTheDocument()
    })
    const body = JSON.parse(mockFetch.mock.calls[1][1].body)
    expect(body.context.topHoldings).toHaveLength(10)
    expect(body.context.topHoldings[0].code).toBe("SYM0")
  })
})
