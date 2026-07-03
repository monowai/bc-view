import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import "@testing-library/jest-dom"
import FxEditModal from "@components/features/transactions/FxEditModal"

jest.mock("swr", () => ({
  __esModule: true,
  mutate: jest.fn(),
  default: jest.fn(() => ({ data: undefined })),
}))

jest.mock("react-hook-form", () => ({
  useForm: () => ({
    control: {},
    handleSubmit:
      () =>
      (e?: Event): Promise<void> => {
        e?.preventDefault?.()
        return Promise.resolve()
      },
    getValues: jest.fn(() => ({})),
    setValue: jest.fn(),
    watch: jest.fn((name: string) => (name === "sellAmount" ? 100 : 100)),
    formState: { errors: {}, isDirty: true },
  }),
  Controller: ({ render: renderFn }: any) =>
    renderFn({ field: { value: "", onChange: jest.fn() } }),
}))

jest.mock("@hookform/resolvers/yup", () => ({
  yupResolver: () => ({}),
}))

jest.mock("yup", () => {
  const chain: any = {}
  const methods = [
    "required",
    "positive",
    "min",
    "max",
    "default",
    "shape",
    "nullable",
  ]
  methods.forEach((m) => {
    chain[m] = () => chain
  })
  return {
    object: () => ({ ...chain }),
    string: () => ({ ...chain }),
    number: () => ({ ...chain }),
  }
})

jest.mock("@lib/assets/assetUtils", () => ({
  stripOwnerPrefix: (s: string) => s,
}))

jest.mock("@lib/trns/tradeUtils", () => ({
  convert: jest.fn(() => "row"),
}))

jest.mock("@lib/trns/formUtils", () => ({
  copyToClipboard: jest.fn(),
}))

jest.mock("@components/ui/DropZone", () => ({
  postData: jest.fn(),
}))

jest.mock("@utils/api/fetchHelper", () => ({
  holdingKey: jest.fn(),
  trnKey: jest.fn(),
}))

jest.mock("@components/ui/MathInput", () => ({
  __esModule: true,
  default: (props: any) => (
    <input
      type="number"
      value={props.value ?? ""}
      onChange={(e) => props.onChange?.(Number(e.target.value))}
    />
  ),
}))

jest.mock("@components/ui/DateInput", () => ({
  __esModule: true,
  default: (props: any) => (
    <input
      type="date"
      value={props.value ?? ""}
      onChange={(e) => props.onChange?.(e.target.value)}
    />
  ),
}))

jest.mock("react-number-format", () => ({
  NumericFormat: ({ value }: any) => <span>{value}</span>,
}))

const trn = {
  id: "t1",
  trnType: "FX_BUY",
  tradeDate: "2025-01-01",
  status: "SETTLED",
  asset: {
    code: "EUR.CASH",
    name: "EUR Balance",
    market: { code: "CASH" },
  },
  cashAsset: {
    code: "GBP.CASH",
    name: "GBP Balance",
    market: { code: "CASH" },
  },
  tradeCurrency: { code: "EUR" },
  cashCurrency: { code: "GBP" },
  tradeAmount: 1000,
  cashAmount: -850,
  fees: 0,
  tax: 0,
  comments: "",
  portfolio: {
    id: "p1",
    code: "MAIN",
    name: "Main Portfolio",
    currency: { code: "GBP" },
  },
}

describe("FxEditModal", () => {
  it("renders the FX Trade title", () => {
    render(
      <FxEditModal trn={trn as any} onClose={jest.fn()} onDelete={jest.fn()} />,
    )
    expect(screen.getByText("FX Trade")).toBeInTheDocument()
  })

  it("calls onClose on Escape", () => {
    const onClose = jest.fn()
    render(
      <FxEditModal trn={trn as any} onClose={onClose} onDelete={jest.fn()} />,
    )
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).toHaveBeenCalled()
  })
})
