import React from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import useSwr from "swr"
import CashInputForm from "@components/features/transactions/CashInputForm"
import { postFxRates } from "@utils/api/client/fx"
import { Portfolio } from "types/beancounter"

jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(),
  mutate: jest.fn(),
}))

jest.mock("@lib/formatters", () => ({
  ...jest.requireActual("@lib/formatters"),
  todayIso: () => "2026-02-03",
}))

jest.mock("@utils/api/client/fx", () => ({
  postFxRates: jest.fn(() => Promise.resolve({ ok: false })),
}))

const portfolio = {
  id: "p1",
  code: "PF1",
  name: "Main",
  currency: { code: "USD" },
} as unknown as Portfolio

const currencies = { data: [{ code: "USD" }, { code: "EUR" }] }

const renderForm = async (initialType?: string): Promise<HTMLElement> => {
  ;(useSwr as unknown as jest.Mock).mockImplementation((key: string) => ({
    data: key.includes("currencies") ? currencies : { data: {} },
    isLoading: false,
  }))
  const { container } = render(
    <CashInputForm
      portfolio={portfolio}
      modalOpen={true}
      setModalOpen={jest.fn()}
      initialType={initialType}
    />,
  )
  await act(async () => {})
  return container
}

const labelledField = (label: string): HTMLElement =>
  screen.getByText(label).parentElement as HTMLElement

describe("CashInputForm", () => {
  it("renders the cash form", async () => {
    const container = await renderForm()
    expect(container.innerHTML).toMatchSnapshot()
  })

  it("renders the FX form", async () => {
    const container = await renderForm("FX")
    expect(container.innerHTML).toMatchSnapshot()
  })

  it("binds fees, tax and comments to the form", async () => {
    await renderForm()
    const fees = labelledField("Fees").querySelector("input")!
    const tax = labelledField("Tax").querySelector("input")!
    const comments = labelledField("Comments").querySelector("input")!
    fireEvent.change(fees, { target: { value: "5" } })
    fireEvent.blur(fees)
    fireEvent.change(tax, { target: { value: "7" } })
    fireEvent.blur(tax)
    fireEvent.change(comments, { target: { value: "memo" } })
    await act(async () => {})
    expect(fees).toHaveValue("5")
    expect(tax).toHaveValue("7")
    expect(comments).toHaveValue("memo")
  })

  it("binds the trade date to the form", async () => {
    await renderForm()
    const date = labelledField("Trade date").querySelector(
      "input",
    ) as HTMLInputElement
    fireEvent.change(date, { target: { value: "2026-01-15" } })
    await act(async () => {})
    expect(date).toHaveValue("2026-01-15")
  })

  it("names the dialog after the chosen type", async () => {
    await renderForm()
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Deposit cash")
    fireEvent.click(screen.getByRole("radio", { name: "FX" }))
    await act(async () => {})
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Exchange currency")
    expect(screen.getByText("From")).toBeInTheDocument()
    expect(screen.getByText("To")).toBeInTheDocument()
  })

  it("keeps the trade date in the same place for every type", async () => {
    await renderForm()
    const before = labelledField("Trade date")
    fireEvent.click(screen.getByRole("radio", { name: "Withdrawal" }))
    await act(async () => {})
    expect(labelledField("Trade date")).toBe(before)
  })

  it("reads the amount back in the button bar", async () => {
    await renderForm()
    const amount = labelledField("Amount").querySelector("input")!
    fireEvent.change(amount, { target: { value: "250" } })
    fireEvent.blur(amount)
    await act(async () => {})
    expect(screen.getByTestId("trn-summary")).toHaveTextContent("Deposit")
    expect(screen.getByTestId("trn-summary")).toHaveTextContent("250.00")
  })

  it("goes back to the market rate after a typed buy amount", async () => {
    ;(postFxRates as jest.Mock).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ data: { rates: { "USD:EUR": { rate: 0.5 } } } }),
    })
    await renderForm("FX")
    const to = labelledField("To").querySelector("select")!
    fireEvent.change(to, { target: { value: "EUR" } })
    await act(async () => {})
    const sell = labelledField("Sell amount").querySelector("input")!
    fireEvent.change(sell, { target: { value: "100" } })
    fireEvent.blur(sell)
    await act(async () => {})
    const buy = labelledField("Buy amount").querySelector("input")!
    expect(buy).toHaveValue("50")
    fireEvent.change(buy, { target: { value: "48" } })
    fireEvent.blur(buy)
    await act(async () => {})
    expect(buy).toHaveValue("48")
    fireEvent.click(screen.getByRole("button", { name: "Use market rate" }))
    await act(async () => {})
    expect(buy).toHaveValue("50")
  })
})
