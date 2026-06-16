import React, { useMemo, useState } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import Dialog from "@components/ui/Dialog"
import MathInput from "@components/ui/MathInput"
import { Asset, Portfolio } from "types/beancounter"
import {
  cashKey,
  holdingKey,
  portfoliosKey,
  simpleFetcher,
} from "@utils/api/fetchHelper"
import { toCashAssetOptions } from "@components/features/transactions/SettlementAccountSelect"
import { usePrivateAssetConfigs } from "@lib/assets/usePrivateAssetConfigs"
import { useUserPreferences } from "@contexts/UserPreferencesContext"
import {
  DefinedContributionBucket,
  useDefinedContribution,
} from "@components/features/independence/useDefinedContribution"
import { buildPayslipPayload, PayslipPayload } from "@utils/trns/payslipPayload"

interface PayslipModalProps {
  modalOpen: boolean
  onClose: () => void
}

const todayIso = (): string => new Date().toISOString().slice(0, 10)

const formatAmount = (n: number): string =>
  n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const parseNum = (s: string): number => {
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

/**
 * Apply per-bucket user overrides on top of the computed defined-contribution
 * buckets. A non-empty override string replaces the computed amount; anything
 * else falls back to the computed value. Pure + hoisted so the React Compiler
 * can memoize the caller without a manual-memoization bailout.
 */
const applyBucketOverrides = (
  buckets: DefinedContributionBucket[] | undefined,
  overrides: Record<string, string>,
): DefinedContributionBucket[] => {
  if (!buckets) return []
  return buckets.map((b) => {
    const override = overrides[b.code]
    return {
      code: b.code,
      amount:
        override !== undefined && override !== ""
          ? parseNum(override)
          : b.amount,
    }
  })
}

const PayslipModal: React.FC<PayslipModalProps> = ({ modalOpen, onClose }) => {
  const { preferences } = useUserPreferences()
  const { configs } = usePrivateAssetConfigs()

  // Portfolios + cash assets (account-wide CASH market). Only fetch when open.
  const { data: portfoliosData } = useSWR(
    modalOpen ? portfoliosKey : null,
    simpleFetcher(portfoliosKey),
  )
  const { data: cashData } = useSWR(
    modalOpen ? cashKey : null,
    simpleFetcher(cashKey),
  )

  const portfolios: Portfolio[] = useMemo(
    () => portfoliosData?.data ?? [],
    [portfoliosData],
  )
  const cashAssets: Asset[] = useMemo(() => {
    const raw = cashData?.data
    if (!raw) return []
    return Array.isArray(raw) ? raw : (Object.values(raw) as Asset[])
  }, [cashData])
  const cashOptions = useMemo(
    () => toCashAssetOptions(cashAssets),
    [cashAssets],
  )

  // The user's CPF policy asset, if any.
  const cpfConfig = useMemo(
    () => configs.find((c) => c.policyType === "CPF"),
    [configs],
  )
  const hasCpfAsset = !!cpfConfig

  // Form state. Portfolio + cash asset prefill from saved preferences (also
  // re-applied on each open below).
  const [grossSalary, setGrossSalary] = useState<string>("")
  const [portfolioId, setPortfolioId] = useState<string>(
    () => preferences?.defaultPayslipPortfolioId ?? "",
  )
  const [cashAssetId, setCashAssetId] = useState<string>(
    () => preferences?.defaultPayslipCashAssetId ?? "",
  )
  const [tax, setTax] = useState<string>("")
  // Per-bucket overrides keyed by bucket code; undefined = use computed value.
  const [bucketOverrides, setBucketOverrides] = useState<
    Record<string, string>
  >({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  // Reset + prefill on open (render-phase reset; React "store previous value").
  const [prevOpen, setPrevOpen] = useState(modalOpen)
  if (modalOpen !== prevOpen) {
    setPrevOpen(modalOpen)
    if (modalOpen) {
      setGrossSalary("")
      setTax("")
      setBucketOverrides({})
      setIsSubmitting(false)
      setSubmitError(null)
      setSubmitSuccess(false)
      setPortfolioId(preferences?.defaultPayslipPortfolioId ?? "")
      setCashAssetId(preferences?.defaultPayslipCashAssetId ?? "")
    }
  }

  // Derive current age from year of birth (mirrors ContributionsStep).
  const currentAge = useMemo(() => {
    const yob = preferences?.yearOfBirth
    if (!yob || yob <= 0) return undefined
    return new Date().getFullYear() - yob
  }, [preferences?.yearOfBirth])

  const grossNum = parseNum(grossSalary)
  const { data: dc } = useDefinedContribution(
    hasCpfAsset ? grossNum : 0,
    hasCpfAsset ? currentAge : undefined,
  )

  const showPension =
    hasCpfAsset &&
    !!dc?.hasDefinedContribution &&
    (dc?.buckets?.length ?? 0) > 0

  // Effective buckets = computed amount unless the user overrode it.
  const effectiveBuckets: DefinedContributionBucket[] = useMemo(
    () => applyBucketOverrides(dc?.buckets, bucketOverrides),
    [dc?.buckets, bucketOverrides],
  )

  const selectedCashCurrency = useMemo(() => {
    const opt = cashOptions.find((o) => o.value === cashAssetId)
    return opt?.currency ?? ""
  }, [cashOptions, cashAssetId])

  const buildPayload = (): PayslipPayload =>
    buildPayslipPayload({
      portfolioId,
      tradeDate: todayIso(),
      grossSalary: grossNum,
      tax: parseNum(tax),
      cashAssetId,
      cashCurrency: selectedCashCurrency,
      cpfAssetId: showPension ? cpfConfig?.assetId : undefined,
      employeeContribution: showPension ? dc?.employeeContribution : undefined,
      buckets: showPension ? effectiveBuckets : undefined,
    })

  const canSubmit = grossNum > 0 && !!portfolioId && !!cashAssetId

  const handleSave = async (): Promise<void> => {
    if (!canSubmit) return
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const payload = buildPayload()
      const response = await fetch("/api/trns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        setSubmitError(
          err.message || err.error || `Failed: ${response.statusText}`,
        )
        return
      }

      // Remember the selection for next time (best-effort).
      try {
        await fetch("/api/me", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            defaultPayslipPortfolioId: portfolioId,
            defaultPayslipCashAssetId: cashAssetId,
          }),
        })
      } catch {
        // Non-fatal — the transactions already posted.
      }

      const portfolio = portfolios.find((p) => p.id === portfolioId)
      if (portfolio) globalMutate(holdingKey(portfolio.code, "today"))
      globalMutate("/api/holdings/aggregated?asAt=today")

      setSubmitSuccess(true)
      setTimeout(() => onClose(), 1000)
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Failed to save payslip",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!modalOpen) return null

  return (
    <Dialog
      title={"Enter Payslip"}
      onClose={onClose}
      maxWidth={"lg"}
      scrollable
      footer={
        <>
          <Dialog.CancelButton onClick={onClose} label={"Cancel"} />
          {submitSuccess ? (
            <button
              type="button"
              className="px-4 py-2 rounded text-white bg-green-600"
              disabled
            >
              <span className="flex items-center">
                <i className="fas fa-check mr-2"></i>
                {"Saved"}
              </span>
            </button>
          ) : (
            <Dialog.SubmitButton
              onClick={handleSave}
              label={"Save"}
              loadingLabel={"Saving..."}
              isSubmitting={isSubmitting}
              disabled={!canSubmit}
            />
          )}
        </>
      }
    >
      <p className="text-sm text-gray-500">
        {
          "Record your pay: salary in, deductions out, and your pension contribution credited."
        }
      </p>

      {/* Gross salary */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {"Gross salary"}
        </label>
        <MathInput
          value={grossSalary === "" ? "" : parseFloat(grossSalary)}
          onChange={(value) => setGrossSalary(String(value))}
          placeholder={"0.00"}
          aria-label={"Gross salary"}
          className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border"
        />
      </div>

      {/* Portfolio */}
      <div>
        <label
          htmlFor="payslip-portfolio"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {"Portfolio"}
        </label>
        <select
          id="payslip-portfolio"
          value={portfolioId}
          onChange={(e) => setPortfolioId(e.target.value)}
          className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border bg-white"
        >
          <option value="">{"Select a portfolio..."}</option>
          {portfolios.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* Cash asset */}
      <div>
        <label
          htmlFor="payslip-cash-asset"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {"Pay into"}
        </label>
        <select
          id="payslip-cash-asset"
          value={cashAssetId}
          onChange={(e) => setCashAssetId(e.target.value)}
          className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border bg-white"
        >
          <option value="">{"Select a cash account..."}</option>
          {cashOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Tax */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {"Tax deducted (optional)"}
        </label>
        <MathInput
          value={tax === "" ? "" : parseFloat(tax)}
          onChange={(value) => setTax(String(value))}
          placeholder={"0.00"}
          aria-label={"Tax deducted"}
          className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border"
        />
      </div>

      {/* Pension section */}
      {showPension && dc && (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-3"
          data-testid="pension-section"
        >
          <div className="font-semibold text-gray-800">
            {"Pension (CPF) contribution"}
          </div>
          <p className="text-xs text-gray-600">
            {
              "Split across your accounts. You can adjust each amount to match your payslip."
            }
          </p>

          {effectiveBuckets.map((b) => (
            <div
              key={b.code}
              className="flex items-center justify-between gap-3"
            >
              <label
                htmlFor={`payslip-bucket-${b.code}`}
                className="text-sm font-medium text-gray-700 w-12"
              >
                {b.code}
              </label>
              <MathInput
                value={
                  bucketOverrides[b.code] !== undefined &&
                  bucketOverrides[b.code] !== ""
                    ? parseFloat(bucketOverrides[b.code])
                    : b.amount
                }
                onChange={(value) =>
                  setBucketOverrides((prev) => ({
                    ...prev,
                    [b.code]: String(value),
                  }))
                }
                aria-label={`CPF ${b.code}`}
                className="flex-1 border-gray-300 rounded-md shadow-sm px-3 py-2 border"
              />
            </div>
          ))}

          <div className="pt-2 border-t border-amber-200 text-xs text-gray-600 space-y-1">
            <div className="flex justify-between">
              <span>{"Your contribution"}</span>
              <span>{formatAmount(dc.employeeContribution)}</span>
            </div>
            <div className="flex justify-between">
              <span>{"Employer contribution"}</span>
              <span>{formatAmount(dc.employerContribution)}</span>
            </div>
          </div>
        </div>
      )}

      <Dialog.ErrorAlert message={submitError} />
    </Dialog>
  )
}

export default PayslipModal
