import * as yup from "yup"
import { Transaction } from "types/beancounter"

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
  tradeDate: new Date().toISOString().split("T")[0],
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
})

// Common CSS classes
export const inputClass =
  "mt-1 block w-full border-gray-300 rounded-md shadow-sm input-height focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
export const labelClass =
  "block text-xs font-medium text-gray-500 uppercase tracking-wide"

// Props for edit mode
export interface EditModeProps {
  transaction: Transaction
  onClose: () => void
  onDelete: () => void
}
