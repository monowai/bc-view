import { TrnUpdatePayload } from "./apiHelper"
import { TradeFormValues } from "./tradeFormHelpers"

/**
 * Derive the settlement currency from form data.
 * Priority: settlement account currency > trade currency > "USD"
 */
export const deriveSettlementCurrency = (
  formData: Pick<TradeFormValues, "settlementAccount" | "tradeCurrency">,
): string =>
  formData.settlementAccount?.currency || formData.tradeCurrency?.value || "USD"

/**
 * Build a TrnUpdatePayload for the PATCH API (edit mode).
 * Handles EXPENSE special case (quantity=1, price=amount).
 */
export const buildEditPayload = (
  formData: TradeFormValues,
  assetId: string,
  selectedModelId?: string,
): TrnUpdatePayload => {
  const settlementCurrency = deriveSettlementCurrency(formData)
  const isExpense = formData.type.value === "EXPENSE"
  const isIncome = formData.type.value === "INCOME"
  const isSimpleAmount = isExpense || isIncome

  return {
    trnType: formData.type.value,
    assetId,
    tradeDate: formData.tradeDate,
    quantity: isSimpleAmount ? 1 : formData.quantity,
    price: isSimpleAmount ? formData.tradeAmount || 0 : formData.price,
    tradeCurrency: formData.tradeCurrency.value,
    tradeAmount: formData.tradeAmount || formData.quantity * formData.price,
    cashCurrency: settlementCurrency,
    cashAssetId: formData.settlementAccount?.value || undefined,
    cashAmount: isExpense
      ? -(formData.tradeAmount || 0)
      : isIncome
        ? formData.tradeAmount || 0
        : formData.cashAmount ||
          -(formData.quantity * formData.price + (formData.fees || 0)),
    fees: formData.fees,
    tax: formData.tax,
    comments: formData.comment || "",
    brokerId: formData.brokerId || undefined,
    status: formData.status?.value || "SETTLED",
    modelId: selectedModelId,
  }
}

/** Shape of the expense creation REST payload */
export interface ExpensePayload {
  portfolioId: string
  data: {
    assetId: string
    trnType: "EXPENSE"
    quantity: 1
    price: number
    tradeCurrency: string
    tradeAmount: number
    cashCurrency: string
    cashAssetId?: string
    cashAmount: number
    tradeDate: string
    fees: number
    tax: number
    comments: string
    status: string
  }[]
}

/**
 * Build the REST payload for direct EXPENSE creation (bypasses message broker).
 */
export const buildExpensePayload = (
  formData: TradeFormValues,
  portfolioId: string,
): ExpensePayload => {
  const settlementCurrency = deriveSettlementCurrency(formData)
  const expenseAmount = formData.tradeAmount || 0

  return {
    portfolioId,
    data: [
      {
        assetId: formData.asset,
        trnType: "EXPENSE",
        quantity: 1,
        price: expenseAmount,
        tradeCurrency: formData.tradeCurrency.value,
        tradeAmount: expenseAmount,
        cashCurrency: settlementCurrency,
        cashAssetId: formData.settlementAccount?.value || undefined,
        cashAmount: -expenseAmount,
        tradeDate: formData.tradeDate,
        fees: formData.fees || 0,
        tax: formData.tax || 0,
        comments: formData.comment || "",
        status: formData.status?.value || "SETTLED",
      },
    ],
  }
}

/** Shape of the income creation REST payload */
export interface IncomePayload {
  portfolioId: string
  data: {
    assetId: string
    trnType: "INCOME"
    quantity: 1
    price: number
    tradeCurrency: string
    tradeAmount: number
    cashCurrency: string
    cashAssetId?: string
    cashAmount: number
    tradeDate: string
    fees: number
    tax: number
    comments: string
    status: string
  }[]
}

/**
 * Build the REST payload for direct INCOME creation (bypasses message broker).
 */
export const buildIncomePayload = (
  formData: TradeFormValues,
  portfolioId: string,
): IncomePayload => {
  const settlementCurrency = deriveSettlementCurrency(formData)
  const incomeAmount = formData.tradeAmount || 0

  return {
    portfolioId,
    data: [
      {
        assetId: formData.asset,
        trnType: "INCOME",
        quantity: 1,
        price: incomeAmount,
        tradeCurrency: formData.tradeCurrency.value,
        tradeAmount: incomeAmount,
        cashCurrency: settlementCurrency,
        cashAssetId: formData.settlementAccount?.value || undefined,
        cashAmount: incomeAmount,
        tradeDate: formData.tradeDate,
        fees: formData.fees || 0,
        tax: formData.tax || 0,
        comments: formData.comment || "",
        status: formData.status?.value || "SETTLED",
      },
    ],
  }
}

/**
 * Enrich form data with cashCurrency for broker CSV submission (create mode).
 */
export const buildCreateModeData = (
  formData: TradeFormValues,
  settlementCurrency: string,
): TradeFormValues & { cashCurrency: { value: string; label: string } } => ({
  ...formData,
  cashCurrency: {
    value: settlementCurrency,
    label: settlementCurrency,
  },
})
