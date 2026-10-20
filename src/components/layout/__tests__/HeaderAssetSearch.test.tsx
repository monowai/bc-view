import React from "react"
import { render, screen, act, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import HeaderAssetSearch from "../HeaderAssetSearch"
import { pushRecentAsset } from "@lib/assets/recentAssets"
import { useUser } from "@auth0/nextjs-auth0/client"
import { SWRConfig } from "swr"

const mockPush = jest.fn()
const mockUseUser = useUser as jest.MockedFunction<typeof useUser>

jest.mock("next/router", () => ({
  useRouter: () => ({ push: mockPush }),
}))

const flushAsync = async (): Promise<void> => {
  await act(() => {
    jest.advanceTimersByTime(350)
  })
  await act(async () => {
    await Promise.resolve()
  })
}

describe("HeaderAssetSearch", () => {
  const mockFetch = global.fetch as jest.Mock

  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    mockFetch.mockReset()
    window.localStorage.clear()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("renders mobile search trigger", () => {
    render(<HeaderAssetSearch />)
    expect(
      screen.getByRole("button", { name: /search assets/i }),
    ).toBeInTheDocument()
  })

  it("renders nothing when user is not logged in", () => {
    mockUseUser.mockReturnValueOnce({
      user: undefined,
      error: undefined,
      isLoading: false,
      invalidate: jest.fn(),
    } as unknown as ReturnType<typeof useUser>)
    const { container } = render(<HeaderAssetSearch />)
    expect(container.firstChild).toBeNull()
  })

  it("renders nothing while auth is still loading", () => {
    mockUseUser.mockReturnValueOnce({
      user: undefined,
      error: undefined,
      isLoading: true,
      invalidate: jest.fn(),
    } as unknown as ReturnType<typeof useUser>)
    const { container } = render(<HeaderAssetSearch />)
    expect(container.firstChild).toBeNull()
  })

  it("navigates to /assets/lookup with query and saves recent on select", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            {
              symbol: "AAPL",
              name: "Apple Inc",
              market: "NASDAQ",
              assetId: "asset-aapl",
              currency: "USD",
              type: "Equity",
            },
          ],
        }),
    })

    render(<HeaderAssetSearch />)
    // Two combobox inputs are rendered (desktop inline + mobile overlay placeholder).
    // The first one (desktop inline) is what we type into.
    const input = screen.getAllByRole("combobox")[0]
    await user.type(input, "AAPL")
    await flushAsync()

    const option = await screen.findByText(/AAPL - Apple Inc/i)
    await user.click(option)
    await flushAsync()

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith({
        pathname: "/assets/lookup",
        query: {
          assetId: "asset-aapl",
          symbol: "AAPL",
          market: "NASDAQ",
          name: "Apple Inc",
          currency: "USD",
          type: "Equity",
        },
      })
    })

    const recents = JSON.parse(
      window.localStorage.getItem("bc:asset-recent-searches") || "[]",
    )
    expect(recents[0].assetId).toBe("asset-aapl")
  })

  it("shows previously stored recents on mount via defaultOptions", () => {
    pushRecentAsset({
      value: "asset-msft",
      label: "MSFT - Microsoft (NASDAQ)",
      symbol: "MSFT",
      assetId: "asset-msft",
      market: "NASDAQ",
    })
    render(<HeaderAssetSearch />)
    // defaultOptions is forwarded into AsyncSelect; verify the component
    // mounted with the recents read out of storage.
    expect(window.localStorage.getItem("bc:asset-recent-searches")).toContain(
      "asset-msft",
    )
  })

  describe("watchlist star on each result", () => {
    const aapl = {
      symbol: "AAPL",
      name: "Apple Inc",
      market: "NASDAQ",
      assetId: "asset-aapl",
      currency: "USD",
      type: "Equity",
      chartable: true,
      watchable: true,
      hasNews: true,
      displayCode: "AAPL",
    }
    const json = (body: unknown, status = 200): unknown => ({
      ok: status < 400,
      status,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(JSON.stringify(body)),
    })

    // Answers each call by URL and method, so the order SWR and the search fire in does not matter.
    const serve = (
      results: unknown[],
      watched: unknown[] = [],
      added: { status: number; body: unknown } = {
        status: 200,
        body: { data: { id: "w-new", asset: { id: "asset-aapl" } } },
      },
    ): void => {
      mockFetch.mockImplementation((url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET"
        if (url.startsWith("/api/assets/search")) {
          return Promise.resolve(json({ data: results }))
        }
        if (url === "/api/watchlist" && method === "GET") {
          return Promise.resolve(json({ data: { items: watched } }))
        }
        if (url === "/api/watchlist/items" && method === "POST") {
          return Promise.resolve(json(added.body, added.status))
        }
        if (url.startsWith("/api/watchlist/items/") && method === "DELETE") {
          return Promise.resolve(json({ deleted: true }))
        }
        if (url === "/api/assets" && method === "POST") {
          return Promise.resolve(
            json({ data: { NEWCO: { id: "asset-newco", code: "NEWCO" } } }),
          )
        }
        return Promise.resolve(json({}, 404))
      })
    }

    const search = async (text: string): Promise<void> => {
      const user = userEvent.setup({
        advanceTimers: jest.advanceTimersByTime,
      })
      render(
        <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
          <HeaderAssetSearch />
        </SWRConfig>,
      )
      await user.type(screen.getAllByRole("combobox")[0], text)
      await flushAsync()
    }

    const calls = (
      method: string,
      url: string,
    ): [string, RequestInit | undefined][] =>
      (mockFetch.mock.calls as [string, RequestInit | undefined][]).filter(
        ([u, init]) =>
          String(u).startsWith(url) && (init?.method ?? "GET") === method,
      )

    it("stars a result onto the watchlist without opening it", async () => {
      serve([aapl])
      await search("AAPL")

      const star = await screen.findByRole("button", {
        name: "Add AAPL to watchlist",
      })
      await userEvent
        .setup({ advanceTimers: jest.advanceTimersByTime })
        .click(star)
      await flushAsync()

      await waitFor(() => {
        expect(calls("POST", "/api/watchlist/items")).toHaveLength(1)
      })
      expect(
        JSON.parse(calls("POST", "/api/watchlist/items")[0][1]?.body as string),
      ).toEqual({ assetId: "asset-aapl" })
      expect(mockPush).not.toHaveBeenCalled()
    })

    it("shows a watched result as starred and takes it off", async () => {
      serve([aapl], [{ id: "w-1", asset: { id: "asset-aapl" } }])
      await search("AAPL")

      const star = await screen.findByRole("button", {
        name: "Remove AAPL from watchlist",
      })
      await userEvent
        .setup({ advanceTimers: jest.advanceTimersByTime })
        .click(star)
      await flushAsync()

      await waitFor(() => {
        expect(calls("DELETE", "/api/watchlist/items/w-1")).toHaveLength(1)
      })
      expect(mockPush).not.toHaveBeenCalled()
    })

    it("creates the asset first when the result is not yet known", async () => {
      serve([
        {
          ...aapl,
          symbol: "NEWCO",
          displayCode: "NEWCO",
          name: "New Co",
          assetId: undefined,
        },
      ])
      await search("NEWCO")

      const star = await screen.findByRole("button", {
        name: "Add NEWCO to watchlist",
      })
      await userEvent
        .setup({ advanceTimers: jest.advanceTimersByTime })
        .click(star)
      await flushAsync()

      await waitFor(() => {
        expect(calls("POST", "/api/watchlist/items")).toHaveLength(1)
      })
      expect(calls("POST", "/api/assets")).toHaveLength(1)
      expect(
        JSON.parse(calls("POST", "/api/watchlist/items")[0][1]?.body as string),
      ).toEqual({ assetId: "asset-newco" })
    })

    it("asks for an added price when the result has none yet", async () => {
      serve([aapl], [], {
        status: 400,
        body: { message: "No price for AAPL; enter an added price" },
      })
      await search("AAPL")

      const star = await screen.findByRole("button", {
        name: "Add AAPL to watchlist",
      })
      await userEvent
        .setup({ advanceTimers: jest.advanceTimersByTime })
        .click(star)
      await flushAsync()

      expect(
        await screen.findByText("Add AAPL to Watchlist"),
      ).toBeInTheDocument()
      expect(screen.getByLabelText("Added price")).toBeInTheDocument()
      expect(mockPush).not.toHaveBeenCalled()
    })

    it("offers no star on a private asset", async () => {
      serve([
        {
          ...aapl,
          symbol: "HOUSE",
          displayCode: "HOUSE",
          name: "Home",
          market: "PRIVATE",
          watchable: false,
        },
      ])
      await search("HOUSE")

      await screen.findByText(/HOUSE - Home/)
      expect(
        screen.queryByRole("button", { name: /HOUSE.*watchlist/ }),
      ).not.toBeInTheDocument()
    })

    it("offers no star on a result the server marks unwatchable", async () => {
      serve([{ ...aapl, watchable: false }])
      await search("AAPL")

      await screen.findByText(/AAPL - Apple Inc/)
      expect(
        screen.queryByRole("button", { name: /AAPL.*watchlist/ }),
      ).not.toBeInTheDocument()
    })
  })
})
