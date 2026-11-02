import React from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import useSwr from "swr"
import CashInputForm from "@components/features/transactions/CashInputForm"
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
    const date = labelledField("Trade Date").querySelector(
      "input",
    ) as HTMLInputElement
    fireEvent.change(date, { target: { value: "2026-01-15" } })
    await act(async () => {})
    expect(date).toHaveValue("2026-01-15")
  })
})
