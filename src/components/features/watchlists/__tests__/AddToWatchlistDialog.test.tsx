import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import { SWRConfig } from "swr"
import AddToWatchlistDialog from "@components/features/watchlists/AddToWatchlistDialog"
import { makeWatchlistItem } from "@test-fixtures/beancounter"

interface Call {
  url: string
  method: string
  body: unknown
}

const NO_PRICE = "No price known for this asset; supply addedPrice"

let calls: Call[] = []
let itemResponses: Array<{ status: number; body: unknown }> = []

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response
}

beforeEach(() => {
  calls = []
  itemResponses = []
  global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method || "GET"
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ url, method, body })
    if (url === "/api/watchlists" && method === "GET") {
      return Promise.resolve(
        jsonResponse(200, {
          data: [
            { id: "wl-1", code: "TECH", name: "Tech ideas", itemCount: 0 },
          ],
        }),
      )
    }
    if (url === "/api/watchlists" && method === "POST") {
      return Promise.resolve(
        jsonResponse(200, {
          data: { id: "wl-new", code: "NEW", name: "New list", items: [] },
        }),
      )
    }
    if (url.endsWith("/items") && method === "POST") {
      const next = itemResponses.shift() || {
        status: 200,
        body: { data: makeWatchlistItem() },
      }
      return Promise.resolve(jsonResponse(next.status, next.body))
    }
    return Promise.resolve(jsonResponse(200, { data: [] }))
  }) as unknown as typeof fetch
})

function renderDialog(
  props: Partial<React.ComponentProps<typeof AddToWatchlistDialog>> = {},
): { onClose: jest.Mock; onAdded: jest.Mock } {
  const onClose = jest.fn()
  const onAdded = jest.fn()
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <AddToWatchlistDialog
        asset={{ id: "asset-1", label: "AAPL" }}
        onClose={onClose}
        onAdded={onAdded}
        {...props}
      />
    </SWRConfig>,
  )
  return { onClose, onAdded }
}

const itemPosts = (): Call[] =>
  calls.filter((c) => c.method === "POST" && c.url.endsWith("/items"))

describe("AddToWatchlistDialog", () => {
  it("posts without addedPrice so the server stamps the latest close", async () => {
    const { onClose, onAdded } = renderDialog()

    await screen.findByRole("option", { name: /TECH/ })
    fireEvent.click(screen.getByRole("button", { name: "Add" }))

    await waitFor(() => expect(onAdded).toHaveBeenCalled())
    expect(itemPosts()).toHaveLength(1)
    expect(itemPosts()[0].url).toBe("/api/watchlists/wl-1/items")
    expect(itemPosts()[0].body).toEqual({ assetId: "asset-1" })
    expect(onClose).toHaveBeenCalled()
  })

  it("sends an optional target price", async () => {
    const { onAdded } = renderDialog()

    await screen.findByRole("option", { name: /TECH/ })
    fireEvent.change(screen.getByLabelText(/target price/i), {
      target: { value: "42.5" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add" }))

    await waitFor(() => expect(onAdded).toHaveBeenCalled())
    expect(itemPosts()[0].body).toEqual({
      assetId: "asset-1",
      targetPrice: 42.5,
    })
  })

  it("shows the server's no-price message and retries with an entered price", async () => {
    itemResponses = [{ status: 400, body: { error: NO_PRICE } }]
    const { onAdded, onClose } = renderDialog()

    await screen.findByRole("option", { name: /TECH/ })
    fireEvent.click(screen.getByRole("button", { name: "Add" }))

    expect(await screen.findByText(NO_PRICE)).toBeInTheDocument()
    expect(onClose).not.toHaveBeenCalled()

    fireEvent.change(screen.getByLabelText(/added price/i), {
      target: { value: "12.34" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add" }))

    await waitFor(() => expect(onAdded).toHaveBeenCalled())
    expect(itemPosts()).toHaveLength(2)
    expect(itemPosts()[1].body).toEqual({
      assetId: "asset-1",
      addedPrice: 12.34,
    })
  })

  it("creates a watchlist inline, then adds the asset to it", async () => {
    const { onAdded } = renderDialog()

    await screen.findByRole("option", { name: /TECH/ })
    fireEvent.change(screen.getByLabelText(/^watchlist$/i), {
      target: { value: "__new__" },
    })
    fireEvent.change(screen.getByLabelText(/^code$/i), {
      target: { value: "new" },
    })
    fireEvent.change(screen.getByLabelText(/^name$/i), {
      target: { value: "New list" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add" }))

    await waitFor(() => expect(onAdded).toHaveBeenCalled())
    const create = calls.find(
      (c) => c.url === "/api/watchlists" && c.method === "POST",
    )
    expect(create?.body).toEqual({ code: "new", name: "New list" })
    expect(itemPosts()[0].url).toBe("/api/watchlists/wl-new/items")
  })

  it("does not create the watchlist twice when the item add is retried", async () => {
    itemResponses = [{ status: 400, body: { error: NO_PRICE } }]
    const { onAdded } = renderDialog()

    await screen.findByRole("option", { name: /TECH/ })
    fireEvent.change(screen.getByLabelText(/^watchlist$/i), {
      target: { value: "__new__" },
    })
    fireEvent.change(screen.getByLabelText(/^code$/i), {
      target: { value: "new" },
    })
    fireEvent.change(screen.getByLabelText(/^name$/i), {
      target: { value: "New list" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add" }))
    await screen.findByText(NO_PRICE)

    fireEvent.change(screen.getByLabelText(/added price/i), {
      target: { value: "5" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Add" }))

    await waitFor(() => expect(onAdded).toHaveBeenCalled())
    expect(
      calls.filter((c) => c.url === "/api/watchlists" && c.method === "POST"),
    ).toHaveLength(1)
    expect(itemPosts()[1].url).toBe("/api/watchlists/wl-new/items")
  })

  it("adds to a fixed watchlist without offering a choice", async () => {
    const { onAdded } = renderDialog({ watchlistId: "wl-fixed" })

    expect(screen.queryByLabelText(/^watchlist$/i)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Add" }))

    await waitFor(() => expect(onAdded).toHaveBeenCalled())
    expect(itemPosts()[0].url).toBe("/api/watchlists/wl-fixed/items")
  })
})
