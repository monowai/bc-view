import React from "react"
import { act, fireEvent, render, screen } from "@testing-library/react"
import "@testing-library/jest-dom"
import FxEditModal from "@components/features/transactions/FxEditModal"
import { postData } from "@components/ui/DropZone"
import { copyToClipboard } from "@lib/trns/formUtils"
import { deleteTrn } from "@utils/api/client/trns"
import { Transaction } from "types/beancounter"

jest.mock("swr", () => ({
  __esModule: true,
  default: jest.fn(() => ({ data: undefined })),
  mutate: jest.fn(),
}))
jest.mock("@components/ui/DropZone", () => ({
  postData: jest.fn(() => Promise.resolve()),
}))
jest.mock("@lib/trns/formUtils", () => ({
  ...jest.requireActual("@lib/trns/formUtils"),
  copyToClipboard: jest.fn(),
}))
jest.mock("@utils/api/client/trns", () => ({
  ...jest.requireActual("@utils/api/client/trns"),
  deleteTrn: jest.fn(() => Promise.resolve({ ok: true })),
}))
jest.mock("@utils/api/client/fx", () => ({
  postFxRates: jest.fn(() =>
    Promise.resolve({
      ok: true,
      json: () =>
        Promise.resolve({ data: { rates: { "USD:EUR": { rate: 0.9 } } } }),
    }),
  ),
}))

const trn = {
  id: "t1",
  trnType: "FX_BUY",
  status: "PROPOSED",
  tradeDate: "2026-02-03",
  quantity: 90,
  tradeAmount: 90,
  cashAmount: -100,
  fees: 1,
  tax: 0,
  comments: "swap",
  tradeCurrency: { code: "EUR" },
  cashCurrency: { code: "USD" },
  portfolio: { id: "p1", code: "PF1" },
  asset: {
    id: "a1",
    code: "EUR",
    displayCode: "EUR",
    name: "Euro",
    market: { code: "CASH" },
  },
  cashAsset: {
    id: "a2",
    code: "USD",
    displayCode: "USD",
    name: "Dollar",
    market: { code: "CASH" },
  },
} as unknown as Transaction

const renderModal = async (): Promise<HTMLElement> => {
  const { container } = render(
    <FxEditModal trn={trn} onClose={jest.fn()} onDelete={jest.fn()} />,
  )
  await act(() => Promise.resolve())
  return container
}

const fieldInput = (label: string): HTMLInputElement =>
  (screen.getByText(label).closest("div") as HTMLElement).querySelector(
    "input",
  ) as HTMLInputElement

describe("FxEditModal form", () => {
  beforeEach(() => jest.clearAllMocks())

  it("renders the dialog", async () => {
    await renderModal()
    expect(document.body.innerHTML).toMatchSnapshot()
  })

  it("copies the same row it saves", async () => {
    await renderModal()
    fireEvent.click(screen.getByTitle("Copy"))
    expect(copyToClipboard).toHaveBeenCalledTimes(1)
    const copied = (copyToClipboard as jest.Mock).mock.calls[0][0] as string
    expect(copied).toMatchSnapshot()

    fireEvent.change(fieldInput("Comments"), { target: { value: "swap 2" } })
    fireEvent.click(screen.getByText("Save"))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(deleteTrn).toHaveBeenCalledWith("t1")
    expect((postData as jest.Mock).mock.calls[0][2].join(",")).toBe(
      copied.replace("swap", "swap 2"),
    )
  })

  it("shows the validation error under an empty amount", async () => {
    await renderModal()
    fireEvent.change(fieldInput("Sell Amount"), { target: { value: "0" } })
    fireEvent.blur(fieldInput("Sell Amount"))
    fireEvent.change(fieldInput("Comments"), { target: { value: "x" } })
    fireEvent.click(screen.getByText("Save"))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0))
    })
    expect(document.querySelector("p.text-red-500")).toBeInTheDocument()
    expect(deleteTrn).not.toHaveBeenCalled()
  })
})
