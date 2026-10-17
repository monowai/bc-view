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
import WatchlistDetail from "@pages/watchlists/[id]"
import {
  makeAsset,
  makeWatchlist,
  makeWatchlistItem,
} from "@test-fixtures/beancounter"
import { Watchlist } from "types/beancounter"

const mockPush = jest.fn()
jest.mock("next/router", () => ({
  useRouter: () => ({ query: { id: "wl-1" }, isReady: true, push: mockPush }),
}))

const WatchlistPage = WatchlistDetail as React.ComponentType<any>

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

beforeEach(() => {
  calls = []
  mockPush.mockClear()
  watchlist = makeWatchlist({
    id: "wl-1",
    code: "TECH",
    name: "Tech ideas",
    items: [priced, unpriced],
  })
  global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method || "GET"
    calls.push({
      url,
      method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    })
    if (url === "/api/watchlists/wl-1" && method === "GET") {
      return Promise.resolve(jsonResponse(200, { data: watchlist }))
    }
    if (url === "/api/watchlists/wl-1" && method === "DELETE") {
      return Promise.resolve(jsonResponse(200, { deleted: "wl-1" }))
    }
    if (url === "/api/watchlists/wl-1" && method === "PATCH") {
      return Promise.resolve(jsonResponse(200, { data: watchlist }))
    }
    if (url.startsWith("/api/watchlists/wl-1/items/")) {
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

describe("Watchlist detail page", () => {
  it("renders the backend's figures verbatim", async () => {
    renderPage()
    await screen.findByText("Tech ideas")

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
    await screen.findByText("Tech ideas")

    const r = within(row("wi-2"))
    expect(r.getByTestId("price")).toHaveTextContent(/^–$/)
    expect(r.getByTestId("day-change")).toHaveTextContent(/^–$/)
    expect(r.getByTestId("since-added")).toHaveTextContent(/^–$/)
    expect(r.getByTestId("target")).toHaveTextContent(/^–$/)
    expect(r.getByTestId("added")).toHaveTextContent("10.00")
  })

  it("shows a private asset without its owner prefix", async () => {
    renderPage()
    await screen.findByText("Tech ideas")

    const r = within(row("wi-2"))
    expect(r.getByText("MYFUND")).toBeInTheDocument()
    expect(r.queryByText(/abcdefghijklmnopqrstuv/)).not.toBeInTheDocument()
  })

  it("clears a target with clearTarget:true", async () => {
    renderPage()
    await screen.findByText("Tech ideas")

    fireEvent.click(
      within(row("wi-1")).getByRole("button", { name: /edit AAA/i }),
    )
    fireEvent.click(screen.getByRole("button", { name: /clear target/i }))

    await waitFor(() =>
      expect(
        calls.find(
          (c) =>
            c.method === "PATCH" && c.url === "/api/watchlists/wl-1/items/wi-1",
        )?.body,
      ).toEqual({ clearTarget: true }),
    )
  })

  it("edits the target and added price, sending only what changed", async () => {
    renderPage()
    await screen.findByText("Tech ideas")

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
          (c) =>
            c.method === "PATCH" && c.url === "/api/watchlists/wl-1/items/wi-1",
        )?.body,
      ).toEqual({ targetPrice: 120 }),
    )
  })

  it("removes an item", async () => {
    renderPage()
    await screen.findByText("Tech ideas")

    fireEvent.click(
      within(row("wi-1")).getByRole("button", { name: /remove AAA/i }),
    )
    fireEvent.click(screen.getByRole("button", { name: "Remove" }))

    await waitFor(() =>
      expect(
        calls.some(
          (c) =>
            c.method === "DELETE" &&
            c.url === "/api/watchlists/wl-1/items/wi-1",
        ),
      ).toBe(true),
    )
  })

  it("renames the watchlist", async () => {
    renderPage()
    await screen.findByText("Tech ideas")

    fireEvent.click(screen.getByRole("button", { name: /more actions/i }))
    fireEvent.click(screen.getByRole("menuitem", { name: /rename/i }))
    fireEvent.change(screen.getByLabelText(/^name$/i), {
      target: { value: "Renamed" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() =>
      expect(
        calls.find(
          (c) => c.method === "PATCH" && c.url === "/api/watchlists/wl-1",
        )?.body,
      ).toEqual({ code: "TECH", name: "Renamed" }),
    )
  })

  it("deletes the watchlist and returns to the list", async () => {
    renderPage()
    await screen.findByText("Tech ideas")

    fireEvent.click(screen.getByRole("button", { name: /more actions/i }))
    fireEvent.click(screen.getByRole("menuitem", { name: /delete/i }))
    fireEvent.click(screen.getByRole("button", { name: "Delete" }))

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/watchlists"))
    expect(
      calls.some(
        (c) => c.method === "DELETE" && c.url === "/api/watchlists/wl-1",
      ),
    ).toBe(true)
  })

  it("explains an empty watchlist", async () => {
    watchlist = makeWatchlist({ id: "wl-1", name: "Tech ideas", items: [] })
    renderPage()

    expect(
      await screen.findByText(/nothing on this watchlist yet/i),
    ).toBeInTheDocument()
  })
})
