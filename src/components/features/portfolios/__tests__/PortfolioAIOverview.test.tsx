import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import PortfolioAIOverview, { clearOverviewCache } from "../PortfolioAIOverview"
import { Portfolio } from "types/beancounter"
import {
  makeAsset,
  makeHoldingGroup,
  makeHoldings,
  makePortfolio,
  makePosition,
} from "@test-fixtures/beancounter"

// react-markdown / remark-gfm mocked globally in jest.setup.js

const mockFetch = jest.fn()
global.fetch = mockFetch

const basePortfolio: Portfolio = makePortfolio({
  id: "p1",
  marketValue: 100_000,
  irr: 0.12,
  gainOnDay: 1_250,
})

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
    expect(agentBody.context.topGainers).toEqual([])
    expect(agentBody.context.topLosers).toEqual([])
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

  it("splits holdings into top gainers and losers by % move", async () => {
    mockFetch
      .mockResolvedValueOnce(holdingsResponse())
      .mockResolvedValueOnce(agentResponse("Movers overview"))
    render(<PortfolioAIOverview portfolio={basePortfolio} />)
    await waitFor(() => {
      expect(screen.getByText("Movers overview")).toBeInTheDocument()
    })
    const agentCall = mockFetch.mock.calls[1]
    expect(agentCall[0]).toBe("/api/agent/query")
    const body = JSON.parse(agentCall[1].body)
    expect(body.context.portfolioCode).toBe("TEST")
    // AAPL up, MSFT down — one of each.
    expect(body.context.topGainers).toHaveLength(1)
    expect(body.context.topGainers[0].code).toBe("AAPL")
    expect(body.context.topLosers).toHaveLength(1)
    expect(body.context.topLosers[0].code).toBe("MSFT")
    expect(body.query).toContain("TEST")
    expect(body.query).toContain("Top gainers")
    expect(body.query).toContain("Top losers")
  })

  it("caps gainers and losers at 5 per side", async () => {
    // 12 holdings: 7 winners with rising % moves, 5 losers with falling % moves.
    const positions = [
      ...Array.from({ length: 7 }, (_, i) =>
        makePosition({
          asset: makeAsset({ code: `WIN${i}`, name: `Winner ${i}` }),
          moneyValues: { marketValue: 1000, gainOnDay: 10 + i, weight: 0.05 },
        }),
      ),
      ...Array.from({ length: 5 }, (_, i) =>
        makePosition({
          asset: makeAsset({ code: `LOSE${i}`, name: `Loser ${i}` }),
          moneyValues: {
            marketValue: 1000,
            gainOnDay: -(10 + i),
            weight: 0.05,
          },
        }),
      ),
    ]
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve(
            makeHoldings({
              holdingGroups: { EQUITY: makeHoldingGroup({ positions }) },
            }),
          ),
      })
      .mockResolvedValueOnce(agentResponse("Capped movers"))
    render(<PortfolioAIOverview portfolio={basePortfolio} />)
    await waitFor(() => {
      expect(screen.getByText("Capped movers")).toBeInTheDocument()
    })
    const body = JSON.parse(mockFetch.mock.calls[1][1].body)
    expect(body.context.topGainers).toHaveLength(5)
    expect(body.context.topLosers).toHaveLength(5)
    // Biggest gainer (largest % move) leads the gainers list.
    expect(body.context.topGainers[0].code).toBe("WIN6")
    // Biggest loser (most negative % move) leads the losers list.
    expect(body.context.topLosers[0].code).toBe("LOSE4")
  })
})
