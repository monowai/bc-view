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
    text: () => Promise.resolve(JSON.stringify(body)),
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
    if (url === "/api/watchlist/items" && method === "POST") {
      const next = itemResponses.shift() || {
        status: 200,
        body: { data: makeWatchlistItem() },
      }
      return Promise.resolve(jsonResponse(next.status, next.body))
    }
    return Promise.resolve(jsonResponse(200, { data: { items: [] } }))
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
  calls.filter((c) => c.method === "POST" && c.url === "/api/watchlist/items")

describe("AddToWatchlistDialog", () => {
  it("posts without addedPrice so the server stamps the latest close", async () => {
    const { onClose, onAdded } = renderDialog()

    fireEvent.click(screen.getByRole("button", { name: "Add" }))

    await waitFor(() => expect(onAdded).toHaveBeenCalled())
    expect(itemPosts()).toHaveLength(1)
    expect(itemPosts()[0].body).toEqual({ assetId: "asset-1" })
    expect(onClose).toHaveBeenCalled()
  })

  it("offers no watchlist choice — there is one per user", () => {
    renderDialog()

    expect(screen.queryByLabelText(/^watchlist$/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/^code$/i)).not.toBeInTheDocument()
  })

  it("sends an optional target price", async () => {
    const { onAdded } = renderDialog()

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

    fireEvent.click(screen.getByRole("button", { name: "Add" }))

    expect(await screen.findByText(NO_PRICE)).toBeInTheDocument()
    expect(screen.getByLabelText(/added price/i)).toHaveAttribute(
      "aria-invalid",
      "true",
    )
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

  it("says the asset is already on the watchlist on a 409", async () => {
    itemResponses = [{ status: 409, body: { error: "duplicate" } }]
    const { onClose } = renderDialog()

    fireEvent.click(screen.getByRole("button", { name: "Add" }))

    expect(
      await screen.findByText(/AAPL is already on your watchlist/i),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/added price/i)).not.toHaveAttribute(
      "aria-invalid",
      "true",
    )
    expect(onClose).not.toHaveBeenCalled()
  })

  it("closes after a successful add even if the refresh fails", async () => {
    const base = global.fetch as jest.Mock
    let added = false
    global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
      if (init?.method === "POST") added = true
      if (added && (init?.method || "GET") === "GET") {
        return Promise.reject(new Error("network down"))
      }
      return base(input, init)
    }) as unknown as typeof fetch
    const { onClose, onAdded } = renderDialog()

    fireEvent.click(screen.getByRole("button", { name: "Add" }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(onAdded).toHaveBeenCalled()
    expect(screen.queryByText("network down")).not.toBeInTheDocument()
  })

  it("asks for an asset when none is given", () => {
    renderDialog({ asset: undefined })

    expect(screen.getByLabelText(/^asset$/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Add" })).toBeDisabled()
  })
})
