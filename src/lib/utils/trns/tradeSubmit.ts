import { Portfolio } from "types/beancounter"
import { TradeFormValues } from "./tradeFormHelpers"
import {
  deriveSettlementCurrency,
  buildEditPayload,
  buildExpensePayload,
  buildIncomePayload,
  buildCreateModeData,
} from "./tradeSubmission"
import { updateTrn } from "./apiHelper"
import { holdingKey } from "@utils/api/fetchHelper"
import { onSubmit } from "./formUtils"

type MutateFn = (key: string) => Promise<any>

export interface SubmitEditModeParams {
  data: TradeFormValues
  transaction: {
    id: string
    portfolio: { id: string; code: string }
    asset: { id: string }
  }
  selectedModelId: string | undefined
  selectedPortfolioId: string
  portfolioChanged: boolean
  portfolios: Portfolio[]
  editMode: { onClose: () => void }
  mutate: MutateFn
  setSubmitError: (error: string | null) => void
  setIsSubmitting: (submitting: boolean) => void
  t: any
}

/**
 * Submit handler for edit mode: PATCH existing transaction via API.
 */
export async function submitEditMode(
  params: SubmitEditModeParams,
): Promise<void> {
  const {
    data,
    transaction,
    selectedModelId,
    selectedPortfolioId,
    portfolioChanged,
    portfolios,
    editMode,
    mutate,
    setSubmitError,
    setIsSubmitting,
    t,
  } = params

  setIsSubmitting(true)
  setSubmitError(null)
  try {
    const payload = buildEditPayload(
      data,
      transaction.asset.id,
      selectedModelId,
    )
    const response = await updateTrn(
      selectedPortfolioId,
      transaction.id,
      payload,
    )
    if (response.ok) {
      setTimeout(() => {
        mutate(holdingKey(transaction.portfolio.code, "today"))
        mutate("/api/holdings/aggregated?asAt=today")
        if (portfolioChanged) {
          const newPortfolio = portfolios.find(
            (p) => p.id === selectedPortfolioId,
          )
          if (newPortfolio) {
            mutate(holdingKey(newPortfolio.code, "today"))
          }
        }
      }, 1500)
      editMode.onClose()
    } else {
      const errorData = await response.json()
      setSubmitError(errorData.message || t("trn.error.update"))
    }
  } catch (error) {
    console.error("Failed to update transaction:", error)
    setSubmitError(t("trn.error.update"))
  } finally {
    setIsSubmitting(false)
  }
}

export interface SubmitExpenseParams {
  data: TradeFormValues
  portfolio: Portfolio
  mutate: MutateFn
  setModalOpen: (open: boolean) => void
  setSubmitError: (error: string | null) => void
  setIsSubmitting: (submitting: boolean) => void
}

/**
 * Submit handler for EXPENSE: direct REST POST (synchronous, bypasses message broker).
 */
export async function submitExpense(
  params: SubmitExpenseParams,
): Promise<void> {
  const {
    data,
    portfolio,
    mutate,
    setModalOpen,
    setSubmitError,
    setIsSubmitting,
  } = params

  setIsSubmitting(true)
  setSubmitError(null)
  try {
    const payload = buildExpensePayload(data, portfolio.id)
    const response = await fetch("/api/trns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (response.ok) {
      setTimeout(() => {
        mutate(holdingKey(portfolio.code, "today"))
        mutate("/api/holdings/aggregated?asAt=today")
      }, 1500)
      setModalOpen(false)
    } else {
      const errorData = await response.json().catch(() => ({}))
      console.error("EXPENSE creation failed:", response.status, errorData)
      setSubmitError(
        errorData.message ||
          errorData.error ||
          `Failed: ${response.statusText}`,
      )
    }
  } catch (error) {
    console.error("EXPENSE submission error:", error)
    setSubmitError(
      error instanceof Error ? error.message : "Failed to create expense",
    )
  } finally {
    setIsSubmitting(false)
  }
}

export interface SubmitIncomeParams {
  data: TradeFormValues
  portfolio: Portfolio
  mutate: MutateFn
  setModalOpen: (open: boolean) => void
  setSubmitError: (error: string | null) => void
  setIsSubmitting: (submitting: boolean) => void
}

/**
 * Submit handler for INCOME: direct REST POST (synchronous, bypasses message broker).
 */
export async function submitIncome(params: SubmitIncomeParams): Promise<void> {
  const {
    data,
    portfolio,
    mutate,
    setModalOpen,
    setSubmitError,
    setIsSubmitting,
  } = params

  setIsSubmitting(true)
  setSubmitError(null)
  try {
    const payload = buildIncomePayload(data, portfolio.id)
    const response = await fetch("/api/trns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (response.ok) {
      setTimeout(() => {
        mutate(holdingKey(portfolio.code, "today"))
        mutate("/api/holdings/aggregated?asAt=today")
      }, 1500)
      setModalOpen(false)
    } else {
      const errorData = await response.json().catch(() => ({}))
      console.error("INCOME creation failed:", response.status, errorData)
      setSubmitError(
        errorData.message ||
          errorData.error ||
          `Failed: ${response.statusText}`,
      )
    }
  } catch (error) {
    console.error("INCOME submission error:", error)
    setSubmitError(
      error instanceof Error ? error.message : "Failed to create income",
    )
  } finally {
    setIsSubmitting(false)
  }
}

export interface SubmitCreateModeParams {
  data: TradeFormValues
  portfolio: Portfolio
  errors: Record<string, any>
  setModalOpen: (open: boolean) => void
  mutate: MutateFn
}

/**
 * Submit handler for create mode: CSV import via message broker.
 */
export function submitCreateMode(params: SubmitCreateModeParams): void {
  const { data, portfolio, errors, setModalOpen, mutate } = params
  const settlementCurrency = deriveSettlementCurrency(data)
  onSubmit(
    portfolio,
    errors,
    buildCreateModeData(data, settlementCurrency),
    (open) => {
      setModalOpen(open)
      if (!open) {
        setTimeout(() => {
          mutate(holdingKey(portfolio.code, "today"))
          mutate("/api/holdings/aggregated?asAt=today")
        }, 1500)
      }
    },
  )
}
