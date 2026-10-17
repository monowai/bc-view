import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import { SWRConfig } from "swr"
import Watchlists from "@pages/watchlists"

const mockPush = jest.fn()
jest.mock("next/router", () => ({
  useRouter: () => ({ query: {}, isReady: true, push: mockPush }),
}))

// withPageAuthRequired HOC strips prop types in v4
const WatchlistsPage = Watchlists as React.ComponentType<any>

interface Call {
  url: string
  method: string
  body: unknown
}
let calls: Call[] = []

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response
}

beforeEach(() => {
  calls = []
  mockPush.mockClear()
  global.fetch = jest.fn((input: RequestInfo, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method || "GET"
    calls.push({
      url,
      method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    })
    if (url === "/api/watchlists" && method === "GET") {
      return Promise.resolve(
        jsonResponse(200, {
          data: [
            { id: "wl-1", code: "TECH", name: "Tech ideas", itemCount: 3 },
            { id: "wl-2", code: "DIV", name: "Dividend ideas", itemCount: 0 },
          ],
        }),
      )
    }
    if (url === "/api/watchlists" && method === "POST") {
      return Promise.resolve(
        jsonResponse(200, {
          data: { id: "wl-9", code: "NEW", name: "Fresh", items: [] },
        }),
      )
    }
    return Promise.resolve(jsonResponse(200, { data: [] }))
  }) as unknown as typeof fetch
})

function renderPage(): void {
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <WatchlistsPage />
    </SWRConfig>,
  )
}

describe("Watchlists page", () => {
  it("lists watchlists with their item counts and links to each", async () => {
    renderPage()

    const tech = await screen.findByRole("link", { name: "TECH" })
    expect(tech).toHaveAttribute("href", "/watchlists/wl-1")
    expect(screen.getByText("Tech ideas")).toBeInTheDocument()
    expect(screen.getByText("Dividend ideas")).toBeInTheDocument()
    expect(screen.getByTestId("item-count-wl-1")).toHaveTextContent("3")
    expect(screen.getByTestId("item-count-wl-2")).toHaveTextContent("0")
  })

  it("creates a watchlist and opens it", async () => {
    renderPage()
    await screen.findByRole("link", { name: "TECH" })

    fireEvent.click(screen.getByRole("button", { name: /new watchlist/i }))
    fireEvent.change(screen.getByLabelText(/^code$/i), {
      target: { value: "new" },
    })
    fireEvent.change(screen.getByLabelText(/^name$/i), {
      target: { value: "Fresh" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Create" }))

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/watchlists/wl-9"),
    )
    const create = calls.find(
      (c) => c.url === "/api/watchlists" && c.method === "POST",
    )
    expect(create?.body).toEqual({ code: "new", name: "Fresh" })
  })

  it("shows the server's message when the code is already taken", async () => {
    ;(global.fetch as jest.Mock).mockImplementation(
      (input: RequestInfo, init?: RequestInit) => {
        if (init?.method === "POST") {
          return Promise.resolve(
            jsonResponse(409, { error: "Watchlist code TECH already exists" }),
          )
        }
        return Promise.resolve(jsonResponse(200, { data: [] }))
      },
    )
    renderPage()

    fireEvent.click(
      await screen.findByRole("button", { name: /new watchlist/i }),
    )
    fireEvent.change(screen.getByLabelText(/^code$/i), {
      target: { value: "tech" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Create" }))

    expect(
      await screen.findByText("Watchlist code TECH already exists"),
    ).toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })
})
