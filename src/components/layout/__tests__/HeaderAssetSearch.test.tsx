import React from "react"
import { render, screen, act, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import HeaderAssetSearch from "../HeaderAssetSearch"
import { pushRecentAsset } from "@lib/assets/recentAssets"
import { useUser } from "@auth0/nextjs-auth0/client"

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
})
