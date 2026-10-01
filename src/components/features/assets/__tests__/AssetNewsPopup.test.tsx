import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { SWRConfig } from "swr"
import AssetNewsPopup from "../AssetNewsPopup"
import { makeNewsArticle } from "@test-fixtures/beancounter"

const mockFetch = jest.fn()
global.fetch = mockFetch

function respond(body: unknown, ok = true): void {
  mockFetch.mockResolvedValueOnce({
    ok,
    status: ok ? 200 : 500,
    json: () => Promise.resolve(body),
  })
}

// Fresh SWR cache per test so one test's response can't leak into the next.
function renderPopup(
  props: Partial<React.ComponentProps<typeof AssetNewsPopup>> = {},
): void {
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <AssetNewsPopup
        symbol="AAPL"
        market="US"
        onClose={jest.fn()}
        {...props}
      />
    </SWRConfig>,
  )
}

describe("AssetNewsPopup", () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it("requests news for the selected asset's ticker and market", async () => {
    respond({})
    renderPopup({ symbol: "GNE", market: "NZX" })

    await screen.findByText(/No recent news/)
    expect(mockFetch).toHaveBeenCalledWith("/api/news?tickers=GNE&market=NZX")
  })

  it("names the asset beside its ticker in the heading", async () => {
    respond({})
    renderPopup({ symbol: "AMZN", market: "US", name: "Amazon.com Inc" })

    const heading = await screen.findByRole("heading", { level: 2 })
    expect(heading).toHaveTextContent("AMZN")
    expect(heading).toHaveTextContent("Amazon.com Inc")
  })

  it("lists each article with its sentiment and summary", async () => {
    respond({
      feed: [
        makeNewsArticle({
          title: "Apple beats estimates",
          summary: "Revenue up on services.",
          sentimentLabel: "Bullish",
        }),
        makeNewsArticle({ title: "Supply chain worries" }),
      ],
      count: 2,
    })
    renderPopup()

    expect(await screen.findByText("Apple beats estimates")).toBeInTheDocument()
    expect(screen.getByText("Supply chain worries")).toBeInTheDocument()
    expect(screen.getByText("Revenue up on services.")).toBeInTheDocument()
    expect(screen.getByText("Bullish")).toBeInTheDocument()
  })

  it("links the headline to the article when the source is a URL", async () => {
    respond({
      feed: [
        makeNewsArticle({
          title: "Apple beats estimates",
          source: "https://www.reuters.com/markets/apple",
        }),
      ],
    })
    renderPopup()

    const link = await screen.findByRole("link", {
      name: /Apple beats estimates/,
    })
    expect(link).toHaveAttribute(
      "href",
      "https://www.reuters.com/markets/apple",
    )
    expect(link).toHaveAttribute("target", "_blank")
    expect(screen.getByText("reuters.com")).toBeInTheDocument()
  })

  it("still renders an article whose source URL is malformed", async () => {
    respond({
      feed: [makeNewsArticle({ title: "Odd source", source: "https://" })],
    })
    renderPopup()

    expect(await screen.findByText("Odd source")).toBeInTheDocument()
    expect(screen.getByText("https://")).toBeInTheDocument()
  })

  it("shows the publisher name when the source is not a URL", async () => {
    respond({
      feed: [makeNewsArticle({ title: "Headline", source: "Benzinga" })],
    })
    renderPopup()

    expect(await screen.findByText("Benzinga")).toBeInTheDocument()
    expect(
      screen.queryByRole("link", { name: /Headline/ }),
    ).not.toBeInTheDocument()
  })

  it("says there is no news when the provider has no coverage", async () => {
    respond({})
    renderPopup({ symbol: "GNE", market: "NZX" })

    expect(
      await screen.findByText("No recent news for GNE."),
    ).toBeInTheDocument()
  })

  it("shows an error when the news request fails", async () => {
    respond({ message: "boom" }, false)
    renderPopup()

    expect(await screen.findByText(/Could not load news/)).toBeInTheDocument()
  })

  it("closes via the dialog's close button", async () => {
    respond({})
    const onClose = jest.fn()
    renderPopup({ onClose })
    await screen.findByText(/No recent news/)

    fireEvent.click(screen.getByText("×"))

    expect(onClose).toHaveBeenCalled()
  })
})
