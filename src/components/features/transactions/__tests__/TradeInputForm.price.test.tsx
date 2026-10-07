import React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import TradeInputForm from "../TradeInputForm"
import { makePortfolio, USD } from "@test-fixtures/beancounter"

// Opened for an asset BC has never priced (Asset Lookup → Trade), the form
// arrives with price 0. It must pull the provider's latest price itself —
// nobody picks the asset from the dropdown on that path, so the select
// handler's fetch never fires.

jest.mock("swr", () => ({
  __esModule: true,
  default: (key: string | null) => {
    if (!key) return { data: undefined, error: undefined, isLoading: false }
    if (key.includes("brokers"))
      return { data: { data: [] }, error: undefined, isLoading: false }
    if (key.includes("markets"))
      return {
        data: {
          data: [{ code: "NASDAQ", name: "NASDAQ", currency: { code: "USD" } }],
        },
        error: undefined,
        isLoading: false,
      }
    if (key.includes("currencies"))
      return {
        data: { data: [{ code: "USD" }] },
        error: undefined,
        isLoading: false,
      }
    return { data: { data: [] }, error: undefined, isLoading: false }
  },
  mutate: jest.fn(),
}))

jest.mock("@contexts/UserPreferencesContext", () => ({
  useUserPreferences: () => ({
    preferences: { id: "u1" },
    isLoading: false,
    refetch: jest.fn(),
  }),
}))

jest.mock("@components/features/assets/AssetSearch", () => ({
  __esModule: true,
  default: () => <input aria-label="Asset" readOnly />,
}))

const portfolio = makePortfolio({
  marketValue: 10000,
  currency: USD,
  base: USD,
})

const priceFetch = (close: number): jest.Mock =>
  jest.fn((url: RequestInfo | URL) => {
    if (String(url).startsWith("/api/prices/")) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [{ close }] }),
      })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
  })

const renderForm = (initialValues: Record<string, unknown>): void => {
  render(
    <TradeInputForm
      portfolio={portfolio}
      modalOpen={true}
      setModalOpen={jest.fn()}
      initialValues={initialValues as never}
    />,
  )
}

const priceCalls = (): string[] =>
  (global.fetch as jest.Mock).mock.calls
    .map((c: unknown[]) => String(c[0]))
    .filter((u: string) => u.startsWith("/api/prices/"))

const investTab = (): HTMLElement =>
  screen.getByRole("button", { name: "Invest" })

const freshAsset = {
  asset: "AAPL",
  assetId: "a-1",
  market: "NASDAQ",
  currency: "USD",
  quantity: 0,
  price: 0,
  type: "BUY" as const,
}

describe("TradeInputForm — price for a preset asset", () => {
  afterEach(() => {
    // @ts-expect-error — restore the jsdom default
    delete global.fetch
  })

  test("fetches the provider price when opened with an unpriced asset", async () => {
    global.fetch = priceFetch(187.5) as unknown as typeof fetch
    renderForm(freshAsset)

    await waitFor(() => expect(investTab()).toBeEnabled())
    expect(priceCalls()).toEqual([
      expect.stringMatching(
        /^\/api\/prices\/NASDAQ\/AAPL\?asAt=\d{4}-\d{2}-\d{2}$/,
      ),
    ])
  })

  test("keeps the caller's price when one is supplied", async () => {
    global.fetch = priceFetch(999) as unknown as typeof fetch
    renderForm({ ...freshAsset, quantity: 100, price: 10, type: "SELL" })

    expect(investTab()).toBeEnabled()
    await waitFor(() => expect(priceCalls()).toEqual([]))
  })

  test("does not ask the provider for a private asset", async () => {
    global.fetch = priceFetch(1) as unknown as typeof fetch
    renderForm({ ...freshAsset, market: "PRIVATE" })

    await waitFor(() => expect(priceCalls()).toEqual([]))
    expect(investTab()).toBeDisabled()
  })
})
