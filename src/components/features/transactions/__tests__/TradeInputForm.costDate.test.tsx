import React from "react"
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react"
import "@testing-library/jest-dom"
import TradeInputForm from "../TradeInputForm"
import { makePortfolio, makeTrn, USD } from "@test-fixtures/beancounter"
import { Transaction } from "types/beancounter"

// An ADD records a holding bought before it was entered. Its cost date is when
// it was paid for, which drives performance (IRR) only. The edit screen shows
// it for an ADD and nowhere else.

jest.mock("swr", () => ({
  __esModule: true,
  default: (key: string | null) => {
    const empty = { data: undefined, error: undefined, isLoading: false }
    if (!key) return empty
    if (key.includes("currencies"))
      return {
        data: { data: [{ code: "USD" }] },
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

const anAdd = (costDate?: string): Transaction =>
  makeTrn({
    trnType: "ADD",
    tradeDate: "2024-01-15",
    portfolio,
    ...(costDate ? { costDate } : {}),
  })

const costDateField = (): HTMLInputElement =>
  screen.getByLabelText("Cost date") as HTMLInputElement

const change = (input: HTMLElement, value: string): void => {
  fireEvent.change(input, { target: { value } })
}

const save = (): void => {
  fireEvent.click(screen.getByRole("button", { name: "Save" }))
}

const sentBody = async (): Promise<Record<string, unknown>> => {
  await waitFor(() => expect(mockFetch).toHaveBeenCalled())
  const [, init] = mockFetch.mock.calls[0]
  return JSON.parse(init.body)
}

describe("TradeInputForm — cost date", () => {
  beforeEach(() => {
    mockFetch.mockReset()
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    })
    global.fetch = mockFetch
  })

  test("shows the cost date for an add, prefilled from the transaction", () => {
    editing(anAdd("2016-11-18"))

    expect(costDateField()).toBeVisible()
    expect(costDateField().value).toBe("2016-11-18")
  })

  test("explains what the cost date is for", () => {
    editing(anAdd("2016-11-18"))

    fireEvent.mouseEnter(screen.getByText("Cost date"))

    expect(
      screen.getByText(
        "When you paid for it. Used for performance (IRR) only; quantity, splits and dividends follow the trade date. Leave blank to use the trade date.",
      ),
    ).toBeVisible()
  })

  test("an add without a cost date shows the field blank", () => {
    editing(anAdd())

    expect(costDateField().value).toBe("")
  })

  test("hides the cost date for any other type", () => {
    editing(makeTrn({ trnType: "BUY", portfolio }))

    expect(screen.queryByLabelText("Cost date")).not.toBeInTheDocument()
  })

  test("saving an add sends its cost date", async () => {
    editing(anAdd("2016-11-18"))

    change(costDateField(), "2015-03-02")
    save()

    const body = await sentBody()
    expect(body.costDate).toBe("2015-03-02")
    expect(body.tradeDate).toBe("2024-01-15")
  })

  test("a blank cost date sends the trade date, which clears it", async () => {
    editing(anAdd("2016-11-18"))

    change(costDateField(), "")
    save()

    const body = await sentBody()
    expect(body.costDate).toBe("2024-01-15")
  })

  test("a cost date after the trade date is an error and does not save", async () => {
    editing(anAdd("2016-11-18"))

    change(costDateField(), "2024-02-01")
    save()

    expect(
      await screen.findByText("Cost date cannot be after the trade date"),
    ).toBeVisible()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  test("moving the trade date past the cost date clears the error", async () => {
    editing(anAdd("2016-11-18"))

    change(costDateField(), "2024-02-01")
    save()
    await screen.findByText("Cost date cannot be after the trade date")

    change(screen.getByLabelText("Trade date"), "2024-03-01")

    await waitFor(() =>
      expect(
        screen.queryByText("Cost date cannot be after the trade date"),
      ).not.toBeInTheDocument(),
    )
  })

  test("the cost date error stays visible on the settlement tab", async () => {
    editing(anAdd("2016-11-18"))

    change(costDateField(), "2024-02-01")
    save()
    await screen.findByText("Cost date cannot be after the trade date")

    fireEvent.click(screen.getByRole("button", { name: "Settlement" }))

    expect(
      screen.getByText("Cost date cannot be after the trade date"),
    ).toBeVisible()
  })

  test("another type sends no cost date", async () => {
    editing(makeTrn({ trnType: "BUY", portfolio, costDate: "2016-11-18" }))

    change(screen.getByLabelText("Trade date"), "2024-01-10")
    save()

    const body = await sentBody()
    expect(body).not.toHaveProperty("costDate")
  })

  test("changing an add to another type hides the cost date and sends none", async () => {
    editing(anAdd("2016-11-18"))

    const type = within(screen.getByTestId("trade-type")).getByRole("combobox")
    fireEvent.keyDown(type, { key: "ArrowDown" })
    fireEvent.click(await screen.findByText("BUY"))

    expect(screen.queryByLabelText("Cost date")).not.toBeInTheDocument()
    save()

    const body = await sentBody()
    expect(body.trnType).toBe("BUY")
    expect(body).not.toHaveProperty("costDate")
  })

  test("a new add offers the cost date too", () => {
    render(
      <TradeInputForm
        portfolio={portfolio}
        modalOpen={true}
        setModalOpen={jest.fn()}
        initialValues={
          {
            asset: "AAPL",
            market: "NASDAQ",
            quantity: 10,
            price: 1,
            currency: "USD",
            type: "ADD",
          } as never
        }
      />,
    )

    expect(costDateField()).toBeVisible()
    expect(costDateField().value).toBe("")
  })
})
