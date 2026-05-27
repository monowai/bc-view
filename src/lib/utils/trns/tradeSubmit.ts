import { Portfolio } from "types/beancounter"
import { mutate as globalMutate } from "swr"
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

/**
 * Extract `warnings` array from a successful TrnResponse, tolerating mocks /
 * responses without a json() method or with no body.
 */
async function parseWarnings(response: Response): Promise<string[]> {
  if (typeof response.json !== "function") return []
  try {
    const body = await response.json()
    return Array.isArray(body?.warnings) ? body.warnings : []
  } catch {
    return []
  }
}

// Invalidate any /api/trns/proposed* SWR cache entry (varies by scope)
const mutateProposedCaches = (): void => {
  globalMutate(
    (key) => typeof key === "string" && key.startsWith("/api/trns/proposed"),
  )
}

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
      mutateProposedCaches()
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
      const errorData = await response.json().catch(() => ({}))
      setSubmitError(errorData.message || "Failed to update transaction")
    }
  } catch (error) {
    console.error("Failed to update transaction:", error)
    setSubmitError("Failed to update transaction")
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
  // Surfaces TrnResponse.warnings (e.g. auto-settle skipped because funding
  // portfolio has no balance in the trade's settlement currency). When the
  // setter is provided AND the response carries warnings, the modal stays
  // open so the user can read them; otherwise it closes as before.
  setSubmitWarnings?: (warnings: string[]) => void
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
    setSubmitWarnings,
  } = params

  setIsSubmitting(true)
  setSubmitError(null)
  setSubmitWarnings?.([])
  try {
    const payload = buildExpensePayload(data, portfolio.id)
    const response = await fetch("/api/trns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (response.ok) {
      const warnings = await parseWarnings(response)
      setTimeout(() => {
        mutate(holdingKey(portfolio.code, "today"))
        mutate("/api/holdings/aggregated?asAt=today")
      }, 1500)
      setSubmitWarnings?.(warnings)
      if (warnings.length === 0) {
        setModalOpen(false)
      }
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
  // See SubmitExpenseParams.setSubmitWarnings.
  setSubmitWarnings?: (warnings: string[]) => void
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
    setSubmitWarnings,
  } = params

  setIsSubmitting(true)
  setSubmitError(null)
  setSubmitWarnings?.([])
  try {
    const payload = buildIncomePayload(data, portfolio.id)
    const response = await fetch("/api/trns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (response.ok) {
      const warnings = await parseWarnings(response)
      setTimeout(() => {
        mutate(holdingKey(portfolio.code, "today"))
        mutate("/api/holdings/aggregated?asAt=today")
      }, 1500)
      setSubmitWarnings?.(warnings)
      if (warnings.length === 0) {
        setModalOpen(false)
      }
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
  setSubmitError: (error: string | null) => void
  mutate: MutateFn
}

/**
 * Submit handler for create mode: CSV import via message broker.
 */
export async function submitCreateMode(
  params: SubmitCreateModeParams,
): Promise<void> {
  const { data, portfolio, errors, setModalOpen, setSubmitError, mutate } =
    params
  const settlementCurrency = deriveSettlementCurrency(data)
  const err = await onSubmit(
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
  if (err) setSubmitError(err)
}
