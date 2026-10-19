import React from "react"
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react"
import "@testing-library/jest-dom"
import { SWRConfig } from "swr"
import WatchlistPageDefault from "@pages/watchlist"
import {
  makeAsset,
  makeWatchlist,
  makeWatchlistItem,
} from "@test-fixtures/beancounter"
import { Watchlist } from "types/beancounter"

// The dialog has its own tests; here it only needs to report a successful add.
jest.mock("@components/features/watchlists/AddToWatchlistDialog", () => {
  return function AddToWatchlistDialog(props: {
    onAdded?: (item: unknown) => void
    onClose: () => void
  }) {
    return (
      <button
        type="button"
        onClick={() => {
          props.onAdded?.({})
          props.onClose()
        }}
      >
        {"stub add"}
      </button>
    )
  }
})

async function addFromDialog(): Promise<void> {
  fireEvent.click(await screen.findByRole("button", { name: "stub add" }))
}

let mockCanRunAi = false
jest.mock("@hooks/usePermissions", () => ({
  usePermissions: () => ({
    ai: mockCanRunAi,
    preview: false,
    admin: false,
    isLoading: false,
  }),
}))

// The popup has its own tests; here it only needs to show which asset it opened for.
jest.mock("@components/features/assets/AssetReviewPopup", () => {
  return function AssetReviewPopup(props: {
    ticker: string
    market?: string
    assetName?: string
  }) {
    return (
      <div>{`review of ${props.ticker} on ${props.market} (${props.assetName})`}</div>
    )
  }
})

// The chart modals have their own tests; here they only show what they opened for.
jest.mock("@components/features/fx/RateChartModal", () => {
  return function RateChartModal(props: { from: string; to: string }) {
    return <div>{`rate chart ${props.from}/${props.to}`}</div>
  }
})
jest.mock("@components/features/holdings/PriceChartPopup", () => {
  return function PriceChartPopup(props: { asset: { code: string } }) {
    return <div>{`price chart ${props.asset.code}`}</div>
  }
})

// withPageAuthRequired HOC strips prop types in v4
const WatchlistPage = WatchlistPageDefault as React.ComponentType<any>

interface Call {
  url: string
  method: string
  body: unknown
}
let calls: Call[] = []
let watchlist: Watchlist

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response
}

// Values chosen so a client-side recomputation would visibly disagree with
// what the backend sent: rendering must echo these, not derive its own.
const priced = makeWatchlistItem({
  id: "wi-1",
  asset: makeAsset({ id: "asset-1", code: "AAA", name: "Alpha Corp" }),
  addedPrice: 80,
  addedOn: "2026-02-03",
  targetPrice: 99,
  price: 90,
  priceDate: "2026-03-04",
  changeOnDay: -1.5,
  changeOnDayPercent: -0.0123,
  changeSinceAdded: 7.77,
  changeSinceAddedPercent: 0.3333,
  toTarget: 0.4444,
})

const unpriced = makeWatchlistItem({
  id: "wi-2",
  asset: makeAsset({
    id: "asset-2",
    // Private assets carry an owner prefix that must never be shown.
    code: "abcdefghijklmnopqrstuv.MYFUND",
    name: "My Fund",
    market: { code: "PRIVATE", name: "Private", currency: undefined as never },
  }),
  addedPrice: 10,
  addedOn: "2026-02-05",
  targetPrice: null,
  price: null,
  priceDate: null,
  changeOnDay: null,
  changeOnDayPercent: null,
  changeSinceAdded: null,
  changeSinceAddedPercent: null,
  toTarget: null,
})

// A currency pair is an ordinary asset: CURRENCY category on the FX market.
const fxPair = makeWatchlistItem({
  id: "wi-3",
  asset: makeAsset({
    id: "asset-3",
    code: "NZDSGD",
    name: "NZD/SGD",
    assetCategory: { id: "CURRENCY", name: "Currency" },
    market: { code: "FX", name: "FX", currency: undefined as never },
  }),
})

beforeEach(() => {
  mockCanRunAi = false
  calls = []
  watchlist = makeWatchlist({ items: [priced, unpriced] })
  global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method || "GET"
    calls.push({
      url,
      method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    })
    if (url === "/api/watchlist" && method === "GET") {
      return Promise.resolve(jsonResponse(200, { data: watchlist }))
    }
    if (url.startsWith("/api/watchlist/items/")) {
      return Promise.resolve(
        jsonResponse(200, method === "DELETE" ? { deleted: "x" } : priced),
      )
    }
    return Promise.resolve(jsonResponse(200, { data: [] }))
  }) as unknown as typeof fetch
})

function renderPage(): void {
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <WatchlistPage />
    </SWRConfig>,
  )
}

const row = (itemId: string): HTMLElement =>
  screen.getByTestId(`watchlist-item-${itemId}`)

describe("Watchlist page", () => {
  it("renders the backend's figures verbatim", async () => {
    renderPage()
    await screen.findByTestId("watchlist-item-wi-1")

    const r = within(row("wi-1"))
    expect(r.getByRole("link", { name: /AAA/ })).toHaveAttribute(
      "href",
      expect.stringContaining("assetId=asset-1"),
    )
    expect(r.getByText("Alpha Corp")).toBeInTheDocument()
    expect(r.getByTestId("price")).toHaveTextContent("90.00")
    expect(r.getByTestId("price")).toHaveTextContent("USD")
    expect(r.getByTestId("price")).toHaveAttribute(
      "title",
      expect.stringContaining("2026"),
    )
    expect(r.getByTestId("day-change")).toHaveTextContent("-1.50")
    expect(r.getByTestId("day-change")).toHaveTextContent("-1.23%")
    expect(r.getByTestId("added")).toHaveTextContent("80.00")
    expect(r.getByTestId("since-added")).toHaveTextContent("+7.77")
    expect(r.getByTestId("since-added")).toHaveTextContent("+33.33%")
    expect(r.getByTestId("target")).toHaveTextContent("99.00")
    expect(r.getByTestId("target")).toHaveTextContent("+44.44%")
  })

  it("shows a dash for every figure the backend left null", async () => {
    renderPage()
    await screen.findByTestId("watchlist-item-wi-1")

    const r = within(row("wi-2"))
    expect(r.getByTestId("price")).toHaveTextContent(/^–$/)
    expect(r.getByTestId("day-change")).toHaveTextContent(/^–$/)
    expect(r.getByTestId("since-added")).toHaveTextContent(/^–$/)
    expect(r.getByTestId("target")).toHaveTextContent(/^–$/)
    expect(r.getByTestId("added")).toHaveTextContent("10.00")
  })

  it("shows a private asset without its owner prefix", async () => {
    renderPage()
    await screen.findByTestId("watchlist-item-wi-1")

    const r = within(row("wi-2"))
    expect(r.getByText("MYFUND")).toBeInTheDocument()
    expect(r.queryByText(/abcdefghijklmnopqrstuv/)).not.toBeInTheDocument()
  })

  it("clears a target with clearTarget:true", async () => {
    renderPage()
    await screen.findByTestId("watchlist-item-wi-1")

    fireEvent.click(
      within(row("wi-1")).getByRole("button", { name: /edit AAA/i }),
    )
    fireEvent.click(screen.getByRole("button", { name: /clear target/i }))

    await waitFor(() =>
      expect(
        calls.find(
          (c) => c.method === "PATCH" && c.url === "/api/watchlist/items/wi-1",
        )?.body,
      ).toEqual({ clearTarget: true }),
    )
  })

  it("edits the target and added price, sending only what changed", async () => {
    renderPage()
    await screen.findByTestId("watchlist-item-wi-1")

    fireEvent.click(
      within(row("wi-1")).getByRole("button", { name: /edit AAA/i }),
    )
    fireEvent.change(screen.getByLabelText(/target price/i), {
      target: { value: "120" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() =>
      expect(
        calls.find(
          (c) => c.method === "PATCH" && c.url === "/api/watchlist/items/wi-1",
        )?.body,
      ).toEqual({ targetPrice: 120 }),
    )
  })

  it("removes an item", async () => {
    renderPage()
    await screen.findByTestId("watchlist-item-wi-1")

    fireEvent.click(
      within(row("wi-1")).getByRole("button", { name: /remove AAA/i }),
    )
    fireEvent.click(screen.getByRole("button", { name: "Remove" }))

    await waitFor(() =>
      expect(
        calls.some(
          (c) => c.method === "DELETE" && c.url === "/api/watchlist/items/wi-1",
        ),
      ).toBe(true),
    )
  })

  it("explains an empty watchlist", async () => {
    watchlist = makeWatchlist({ items: [] })
    renderPage()

    expect(
      await screen.findByText(/nothing on your watchlist yet/i),
    ).toBeInTheDocument()
  })

  it("is titled Watchlist", async () => {
    renderPage()

    expect(
      await screen.findByRole("heading", { name: "Watchlist" }),
    ).toBeInTheDocument()
  })

  it("does not report a failed remove when only the refresh fails", async () => {
    const base = global.fetch as jest.Mock
    let removed = false
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      if (init?.method === "DELETE") removed = true
      if (removed && (init?.method || "GET") === "GET") {
        return Promise.reject(new Error("network down"))
      }
      return base(input, init)
    }) as unknown as typeof fetch
    renderPage()
    await screen.findByTestId("watchlist-item-wi-1")

    fireEvent.click(
      within(row("wi-1")).getByRole("button", { name: /remove AAA/i }),
    )
    fireEvent.click(screen.getByRole("button", { name: "Remove" }))

    await waitFor(() => expect(removed).toBe(true))
    expect(screen.queryByText(/network down|remove failed/i)).toBeNull()
  })

  it("clears an earlier error once a later action succeeds", async () => {
    const base = global.fetch as jest.Mock
    let deletes = 0
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      if (init?.method === "DELETE" && ++deletes === 1) {
        return Promise.resolve(jsonResponse(500, { error: "Remove broke" }))
      }
      return base(input, init)
    }) as unknown as typeof fetch
    renderPage()
    await screen.findByTestId("watchlist-item-wi-1")

    fireEvent.click(
      within(row("wi-1")).getByRole("button", { name: /remove AAA/i }),
    )
    fireEvent.click(screen.getByRole("button", { name: "Remove" }))
    expect(await screen.findByText("Remove broke")).toBeInTheDocument()

    fireEvent.click(
      within(row("wi-1")).getByRole("button", { name: /remove AAA/i }),
    )
    fireEvent.click(screen.getByRole("button", { name: "Remove" }))

    await waitFor(() => expect(deletes).toBe(2))
    await waitFor(() =>
      expect(screen.queryByText("Remove broke")).not.toBeInTheDocument(),
    )
  })

  it("keeps an edited added price when clearing the target", async () => {
    renderPage()
    await screen.findByTestId("watchlist-item-wi-1")

    fireEvent.click(
      within(row("wi-1")).getByRole("button", { name: /edit AAA/i }),
    )
    fireEvent.change(screen.getByLabelText(/added price/i), {
      target: { value: "85" },
    })
    fireEvent.click(screen.getByRole("button", { name: /clear target/i }))

    await waitFor(() =>
      expect(
        calls.find(
          (c) => c.method === "PATCH" && c.url === "/api/watchlist/items/wi-1",
        )?.body,
      ).toEqual({ clearTarget: true, addedPrice: 85 }),
    )
  })

  it("shows the empty state when the response carries no items", async () => {
    watchlist = {} as Watchlist
    renderPage()

    expect(
      await screen.findByText(/nothing on your watchlist yet/i),
    ).toBeInTheDocument()
  })

  it("names the currency on an unpriced row", async () => {
    renderPage()
    await screen.findByTestId("watchlist-item-wi-1")

    expect(within(row("wi-2")).getByTestId("added")).toHaveTextContent("USD")
  })

  it("clears an earlier error once an add succeeds", async () => {
    const base = global.fetch as jest.Mock
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      if (init?.method === "DELETE") {
        return Promise.resolve(jsonResponse(500, { error: "Remove broke" }))
      }
      if (init?.method === "POST") {
        return Promise.resolve(jsonResponse(200, { data: priced }))
      }
      return base(input, init)
    }) as unknown as typeof fetch
    renderPage()
    await screen.findByTestId("watchlist-item-wi-1")

    fireEvent.click(
      within(row("wi-1")).getByRole("button", { name: /remove AAA/i }),
    )
    fireEvent.click(screen.getByRole("button", { name: "Remove" }))
    expect(await screen.findByText("Remove broke")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /add asset/i }))
    await addFromDialog()

    await waitFor(() =>
      expect(screen.queryByText("Remove broke")).not.toBeInTheDocument(),
    )
  })

  it("offers an AI review beside each eligible asset, for that asset", async () => {
    mockCanRunAi = true
    renderPage()
    await screen.findByTestId("watchlist-item-wi-1")

    fireEvent.click(
      within(row("wi-1")).getByRole("button", { name: "AI review AAA" }),
    )

    expect(
      screen.getByText("review of AAA on NASDAQ (Alpha Corp)"),
    ).toBeInTheDocument()
  })

  it("offers an AI review of a currency pair on the FX market", async () => {
    mockCanRunAi = true
    watchlist = makeWatchlist({ items: [priced, fxPair] })
    renderPage()
    await screen.findByTestId("watchlist-item-wi-3")

    fireEvent.click(
      within(row("wi-3")).getByRole("button", { name: "AI review NZDSGD" }),
    )

    expect(
      screen.getByText("review of NZDSGD on FX (NZD/SGD)"),
    ).toBeInTheDocument()
  })

  it("offers no AI review of a private asset", async () => {
    mockCanRunAi = true
    renderPage()
    await screen.findByTestId("watchlist-item-wi-1")

    expect(
      within(row("wi-2")).queryByRole("button", { name: /AI review/ }),
    ).not.toBeInTheDocument()
  })

  it("offers no AI review without AI access", async () => {
    renderPage()
    await screen.findByTestId("watchlist-item-wi-1")

    expect(
      screen.queryByRole("button", { name: /AI review/ }),
    ).not.toBeInTheDocument()
  })

  it("no longer offers an AI summary of the whole watchlist", async () => {
    mockCanRunAi = true
    renderPage()
    await screen.findByTestId("watchlist-item-wi-1")

    expect(
      screen.queryByRole("button", { name: "AI Summary" }),
    ).not.toBeInTheDocument()
  })

  describe("chart", () => {
    const cashItem = makeWatchlistItem({
      id: "wi-4",
      asset: makeAsset({
        id: "asset-4",
        code: "USD",
        assetCategory: { id: "CASH", name: "Cash" },
      }),
    })

    beforeEach(() => {
      watchlist = makeWatchlist({ items: [priced, fxPair, cashItem] })
    })

    it("opens the FX rate chart, base to quote, for a currency pair", async () => {
      renderPage()
      await screen.findByTestId("watchlist-item-wi-3")

      fireEvent.click(
        within(row("wi-3")).getByRole("button", {
          name: /price chart for NZDSGD/i,
        }),
      )

      expect(screen.getByText("rate chart NZD/SGD")).toBeInTheDocument()
      expect(screen.queryByText(/^price chart/)).not.toBeInTheDocument()
    })

    it("opens the price chart for an equity", async () => {
      renderPage()
      await screen.findByTestId("watchlist-item-wi-1")

      fireEvent.click(
        within(row("wi-1")).getByRole("button", {
          name: /price chart for AAA/i,
        }),
      )

      expect(screen.getByText("price chart AAA")).toBeInTheDocument()
      expect(screen.queryByText(/rate chart/)).not.toBeInTheDocument()
    })

    it("offers no chart for a category that cannot be charted", async () => {
      renderPage()
      await screen.findByTestId("watchlist-item-wi-4")

      expect(
        within(row("wi-4")).queryByRole("button", { name: /price chart/i }),
      ).not.toBeInTheDocument()
    })
  })
})
