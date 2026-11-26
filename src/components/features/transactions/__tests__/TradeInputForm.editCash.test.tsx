import React from "react"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import "@testing-library/jest-dom"
import TradeInputForm from "../TradeInputForm"
import { makePortfolio, makeTrn, USD } from "@test-fixtures/beancounter"
import { Transaction } from "types/beancounter"

// Editing a trade's quantity or price must move its cash with it. The cash
// figure is never typed on the trade form: it follows the amount at the rate
// the trade settled at, so a trade settled in another currency keeps its rate.

jest.mock("swr", () => ({
  __esModule: true,
  default: (key: string | null) => {
    const empty = { data: undefined, error: undefined, isLoading: false }
    if (!key) return empty
    if (key.includes("currencies"))
      return {
        data: { data: [{ code: "USD" }, { code: "SGD" }] },
        error: undefined,
        isLoading: false,
      }
    if (key.includes("markets"))
      return {
        data: {
          data: [{ code: "NASDAQ", name: "NASDAQ", currency: { code: "USD" } }],
        },
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

const mockFetch = jest.fn()

const editing = (trn: Transaction): ReturnType<typeof render> =>
  render(
    <TradeInputForm
      portfolio={portfolio}
      modalOpen={true}
      setModalOpen={jest.fn()}
      editMode={{
        transaction: trn,
        onClose: jest.fn(),
        onDelete: jest.fn(),
      }}
    />,
  )

const aBuy = (cashAmount: number, cashCurrency = "USD"): Transaction =>
  makeTrn({
    trnType: "BUY",
    portfolio,
    quantity: 1,
    price: 200,
    tradeAmount: 200,
    cashAmount,
    cashCurrency,
    fees: 0,
    tax: 0,
  })

const setQuantity = (value: string): void => {
  const qty = screen.getByLabelText(/Qty/)
  fireEvent.change(qty, { target: { value } })
  fireEvent.blur(qty)
}

const save = (): void => {
  fireEvent.click(screen.getByRole("button", { name: "Save" }))
}

const sentBody = async (): Promise<Record<string, unknown>> => {
  await waitFor(() => expect(mockFetch).toHaveBeenCalled())
  const [, init] = mockFetch.mock.calls[0]
  return JSON.parse(init.body)
}

describe("TradeInputForm — cash follows an edited amount", () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    })
    global.fetch = mockFetch
  })

  test("doubling the quantity doubles the cash", async () => {
    editing(aBuy(-200))

    setQuantity("2")
    save()

    const body = await sentBody()
    expect(body.tradeAmount).toBe(400)
    expect(body.cashAmount).toBe(-400)
  })

  test("a trade settled in another currency keeps its rate", async () => {
    editing(aBuy(-270, "SGD"))

    setQuantity("2")
    save()

    const body = await sentBody()
    expect(body.cashAmount).toBe(-540)
  })

  test("a same-currency trade saved with the wrong cash is put right on save", async () => {
    editing(
      makeTrn({
        trnType: "BUY",
        portfolio,
        quantity: 2,
        price: 200,
        tradeAmount: 400,
        cashAmount: -200,
        cashCurrency: "USD",
        fees: 0,
        tax: 0,
      }),
    )

    fireEvent.change(screen.getByRole("textbox", { name: "Comments" }), {
      target: { value: "fix cash" },
    })
    save()

    const body = await sentBody()
    expect(body.cashAmount).toBe(-400)
  })

  test("an edit that leaves the amount alone keeps the saved cash", async () => {
    editing(aBuy(-270, "SGD"))

    fireEvent.change(screen.getByRole("textbox", { name: "Comments" }), {
      target: { value: "moved broker" },
    })
    save()

    const body = await sentBody()
    expect(body.cashAmount).toBe(-270)
  })
})
