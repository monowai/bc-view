import * as yup from "yup"
import { Transaction } from "types/beancounter"
import { todayIso } from "@lib/formatters"
import { hasCostDate } from "./tradeUtils"

export const COST_DATE_AFTER_TRADE_DATE =
  "Cost date cannot be after the trade date"

export const COST_DATE_HELP =
  "When you paid for it. Used for performance (IRR) only; quantity, splits and dividends follow the trade date. Leave blank to use the trade date."

export const TradeTypeValues = [
  "BUY",
  "SELL",
  "ADD",
  "REDUCE",
  "DIVI",
  "SPLIT",
  "EXPENSE",
  "INCOME",
] as const

export const defaultValues = {
  type: { value: "BUY", label: "BUY" },
  status: { value: "PROPOSED", label: "PROPOSED" },
  asset: "",
  market: "US",
  tradeDate: todayIso(),
  quantity: 0,
  price: 0,
  tradeCurrency: { value: "USD", label: "USD" },
  settlementAccount: { value: "", label: "", currency: "" },
  tradeAmount: 0,
  cashAmount: 0,
  fees: 0,
  tax: 0,
  comment: "",
  brokerId: "",
  costDate: "",
}

export const schema = yup.object().shape({
  type: yup
    .object()
    .shape({
      value: yup.string().required().default(defaultValues.type.value),
      label: yup.string().required().default(defaultValues.type.label),
    })
    .required(),
  status: yup
    .object()
    .shape({
      value: yup.string().required().default(defaultValues.status.value),
      label: yup.string().required().default(defaultValues.status.label),
    })
    .required(),
  asset: yup.string().required(),
  market: yup.string().required(),
  tradeDate: yup.string().required(),
  quantity: yup.number().default(0).required(),
  price: yup.number().required().default(0),
  tradeCurrency: yup
    .object()
    .shape({
      value: yup.string().required(),
      label: yup.string().required(),
    })
    .required(),
  tradeAmount: yup.number(),
  settlementAccount: yup
    .object()
    .shape({
      value: yup.string(),
      label: yup.string(),
      currency: yup.string(),
    })
    .nullable(),
  cashAmount: yup.number(),
  fees: yup.number().required().default(defaultValues.fees),
  tax: yup.number().required().default(defaultValues.tax),
  comment: yup.string().notRequired(),
  brokerId: yup.string().default(""),
  // ADD only: when it was paid for. Blank means the trade date.
  costDate: yup
    .string()
    .default("")
    .test("not-after-trade-date", COST_DATE_AFTER_TRADE_DATE, function (value) {
      const { type, tradeDate } = this.parent
      return (
        !hasCostDate(type?.value) || !value || !tradeDate || value <= tradeDate
      )
    }),
})

// Props for edit mode
export interface EditModeProps {
  transaction: Transaction
  onClose: () => void
  onDelete: () => void
  // Revert SETTLED → PROPOSED via PATCH /trns/{trnId}/status. Optional —
  // surfaces only when the host provides this handler AND the transaction
  // is currently SETTLED.
  onUnsettle?: () => void
}
