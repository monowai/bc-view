import React, { useMemo, useState } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import Dialog from "@components/ui/Dialog"
import MathInput from "@components/ui/MathInput"
import { Asset, Portfolio } from "types/beancounter"
import { PlansResponse, WorkScenariosResponse } from "types/independence"
import {
  accountsKey,
  cashKey,
  holdingKey,
  portfoliosKey,
  simpleFetcher,
  tradeAccountsKey,
} from "@utils/api/fetchHelper"
import {
  toCashAssetOptions,
  toSettlementAccountOptions,
} from "@components/features/transactions/SettlementAccountSelect"
import { usePrivateAssetConfigs } from "@lib/assets/usePrivateAssetConfigs"
import { useUserPreferences } from "@contexts/UserPreferencesContext"
import {
  DefinedContributionBucket,
  useDefinedContribution,
} from "@components/features/independence/useDefinedContribution"
import { buildPayslipPayload, PayslipPayload } from "@utils/trns/payslipPayload"
import { showPortfolioPicker, solePortfolioId } from "@lib/user/zenMode"

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

// SWR payloads arrive as either an array or a keyed object; normalise to array.
const toAssetArray = (raw: unknown): Asset[] => {
  if (!raw) return []
  return Array.isArray(raw) ? raw : (Object.values(raw) as Asset[])
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
  // Private cash-bearing assets held across the account: TRADE (brokerage cash)
  // and ACCOUNT (bank) categories. Mirrors trade-settlement so "Pay into" can
  // target a named private account, not just a generic currency balance.
  const { data: tradeAccountsData } = useSWR(
    modalOpen ? tradeAccountsKey : null,
    simpleFetcher(tradeAccountsKey),
  )
  const { data: bankAccountsData } = useSWR(
    modalOpen ? accountsKey : null,
    simpleFetcher(accountsKey),
  )
  // Seed the Gross salary from the user's work plan — a payslip is one
  // month's pay. The authoritative monthly working income lives on the
  // ACTIVE work scenario, not the RetirementPlan (whose workingIncomeMonthly
  // is 0 when income is held in the scenario). Prefer the current scenario,
  // fall back to the primary plan's field.
  const scenariosKey = "/api/independence/work-scenarios"
  const { data: scenariosData } = useSWR<WorkScenariosResponse>(
    modalOpen ? scenariosKey : null,
    simpleFetcher(scenariosKey),
  )
  const plansKey = "/api/independence/plans"
  const { data: plansData } = useSWR<PlansResponse>(
    modalOpen ? plansKey : null,
    simpleFetcher(plansKey),
  )
  const scenarioIncome = scenariosData?.data?.find(
    (s) => s.isCurrent,
  )?.workingIncomeMonthly
  const planIncome = plansData?.data?.[0]?.workingIncomeMonthly
  const income = scenarioIncome ?? planIncome
  const defaultGross = income && income > 0 ? String(income) : ""

  const portfolios: Portfolio[] = useMemo(
    () => portfoliosData?.data ?? [],
    [portfoliosData],
  )
  const cashAssets: Asset[] = useMemo(
    () => toAssetArray(cashData?.data),
    [cashData],
  )
  const tradeAccounts: Asset[] = useMemo(
    () => toAssetArray(tradeAccountsData?.data),
    [tradeAccountsData],
  )
  const bankAccounts: Asset[] = useMemo(
    () => toAssetArray(bankAccountsData?.data),
    [bankAccountsData],
  )

  // Generic currency balances (CASH market) shown as one group...
  const cashOptions = useMemo(
    () => toCashAssetOptions(cashAssets),
    [cashAssets],
  )
  // ...and named private accounts (bank first, then brokerage) as another.
  const accountOptions = useMemo(
    () => [
      ...toSettlementAccountOptions(bankAccounts),
      ...toSettlementAccountOptions(tradeAccounts),
    ],
    [bankAccounts, tradeAccounts],
  )

  // The user's CPF policy asset, if any.
  const cpfConfig = useMemo(
    () => configs.find((c) => c.policyType === "CPF"),
    [configs],
  )
  const hasCpfAsset = !!cpfConfig

  // The portfolio that holds the CPF asset — the payslip defaults to it so the
  // contribution lands in the right place. Uses the asset "where held" endpoint
  // (one targeted lookup) rather than scanning every portfolio's holdings.
  const cpfAssetId = cpfConfig?.assetId
  const { data: cpfPortfolioId } = useSWR(
    modalOpen && cpfAssetId
      ? `/api/assets/${cpfAssetId}/positions?date=today`
      : null,
    async (url: string): Promise<string> => {
      const res = await fetch(url)
      if (!res.ok) return ""
      const json = await res.json().catch(() => null)
      return json?.data?.[0]?.portfolio?.id ?? ""
    },
  )

  // Form state. Portfolio + cash asset prefill from saved preferences (also
  // re-applied on each open below).
  const [grossSalary, setGrossSalary] = useState<string>(() => defaultGross)
  // Tracks whether the user has typed into Gross salary, so the plan-income
  // default never clobbers a manual entry.
  const [grossTouched, setGrossTouched] = useState(false)
  // Explicit user pick; "" follows the derived default (CPF portfolio first).
  const [portfolioId, setPortfolioId] = useState<string>("")
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
      setGrossSalary(defaultGross)
      setGrossTouched(false)
      setTax("")
      setBucketOverrides({})
      setIsSubmitting(false)
      setSubmitError(null)
      setSubmitSuccess(false)
      setPortfolioId("")
      setCashAssetId(preferences?.defaultPayslipCashAssetId ?? "")
    }
  }

  // The plan often loads after the modal opens; apply its income once it
  // arrives, but only while the field is still untouched and pristine.
  const [prevDefaultGross, setPrevDefaultGross] = useState(defaultGross)
  if (defaultGross !== prevDefaultGross) {
    setPrevDefaultGross(defaultGross)
    if (modalOpen && !grossTouched && defaultGross !== "") {
      setGrossSalary(defaultGross)
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

  // Show the pension box whenever the user has a CPF contribution plan and has
  // entered a gross — don't hide it on the live recompute's verdict. The plan's
  // existence (the CPF asset) is the signal, not whether a given salary happens
  // to produce a defined contribution. Paired with `keepPreviousData` in
  // useDefinedContribution, the box stays mounted across keystrokes (no flash).
  const showPension = hasCpfAsset && grossNum > 0

  // Effective buckets = computed amount unless the user overrode it.
  const effectiveBuckets: DefinedContributionBucket[] = useMemo(
    () => applyBucketOverrides(dc?.buckets, bucketOverrides),
    [dc?.buckets, bucketOverrides],
  )

  // Best "Pay into" match for the user's reporting currency. Preference order
  // mirrors the dropdown: private accounts (bank, then brokerage) before a
  // generic currency balance. Never hardcode USD — fall back to the user's
  // first actual account so a wholly-SGD user defaults to SGD, not USD.
  const reportingCurrency = preferences?.reportingCurrencyCode
  const preferredCashAssetId = useMemo(() => {
    const all = [...accountOptions, ...cashOptions]
    const match = reportingCurrency
      ? all.find((o) => o.currency === reportingCurrency)
      : undefined
    return (match ?? all[0])?.value ?? ""
  }, [accountOptions, cashOptions, reportingCurrency])

  // Derived selection: the user's explicit pick, else the reporting-currency
  // default. Derived (not effect-set) so the React Compiler is happy and the
  // default appears the moment the account lists load.
  const effectiveCashAssetId = cashAssetId || preferredCashAssetId

  // Zen mode: a single portfolio means nothing to choose — hide the selector
  // and auto-target that portfolio. Master mode shows the picker. Both the
  // picker decision and "the one portfolio" come from the shared helper so an
  // explicit SystemUser flag can override behaviour everywhere at once, and the
  // picker is never hidden when there's nothing concrete to target.
  const showPicker = showPortfolioPicker(portfolios, preferences)
  const soleId = solePortfolioId(portfolios)

  // Portfolio default order: explicit pick → CPF-holding portfolio → sole
  // portfolio → saved pref. The sole portfolio outranks the saved default so a
  // single-portfolio user can't post to a stale/deleted id that the now-hidden
  // selector gives no way to correct. CPF still wins so contributions land
  // right (for a single-portfolio user CPF and sole are the same portfolio).
  const effectivePortfolioId =
    portfolioId ||
    cpfPortfolioId ||
    soleId ||
    preferences?.defaultPayslipPortfolioId ||
    ""

  const selectedCashCurrency = useMemo(() => {
    const opt = [...cashOptions, ...accountOptions].find(
      (o) => o.value === effectiveCashAssetId,
    )
    return opt?.currency ?? ""
  }, [cashOptions, accountOptions, effectiveCashAssetId])

  const buildPayload = (): PayslipPayload =>
    buildPayslipPayload({
      portfolioId: effectivePortfolioId,
      tradeDate: todayIso(),
      grossSalary: grossNum,
      tax: parseNum(tax),
      cashAssetId: effectiveCashAssetId,
      cashCurrency: selectedCashCurrency,
      cpfAssetId: showPension && dc ? cpfConfig?.assetId : undefined,
      employeeContribution: showPension && dc ? dc.employeeContribution : undefined,
      buckets: showPension && dc ? effectiveBuckets : undefined,
    })

  const canSubmit =
    grossNum > 0 && !!effectivePortfolioId && !!effectiveCashAssetId

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
            defaultPayslipPortfolioId: effectivePortfolioId,
            defaultPayslipCashAssetId: effectiveCashAssetId,
          }),
        })
      } catch {
        // Non-fatal — the transactions already posted.
      }

      const portfolio = portfolios.find((p) => p.id === effectivePortfolioId)
      if (portfolio) globalMutate(holdingKey(portfolio.code, "today"))
      globalMutate("/api/holdings/aggregated?asAt=today")
      // Wealth screen sums portfolio.marketValue from this list; without
      // invalidating it the top-line total stays stale after a payslip posts.
      globalMutate(portfoliosKey)

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
          onChange={(value) => {
            setGrossTouched(true)
            setGrossSalary(String(value))
          }}
          placeholder={"0.00"}
          aria-label={"Gross salary"}
          className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border"
        />
      </div>

      {/* Pension section — sits directly under Gross salary since CPF is
          derived from gross and the user reviews it before allocating pay.
          Shown whenever the user has a CPF plan (not gated on the live
          recompute landing) so it never blinks out mid-edit; the per-bucket
          and total figures fill in once `dc` resolves. */}
      {showPension && (
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
                className="flex-1 border-gray-300 rounded-md shadow-sm px-3 py-2 border text-right"
              />
            </div>
          ))}

          {dc && (
            <div className="pt-2 border-t border-amber-200 text-xs text-gray-600 space-y-1">
              <div className="flex justify-between">
                <span>{"Your contribution"}</span>
                <span>{formatAmount(dc.employeeContribution)}</span>
              </div>
              <div className="flex justify-between">
                <span>{"Employer contribution"}</span>
                <span>{formatAmount(dc.employerContribution)}</span>
              </div>
              <div
                className="flex justify-between pt-1 border-t border-amber-200 font-semibold text-gray-800"
                data-testid="pension-total"
              >
                <span>{"Total contribution"}</span>
                <span>
                  {formatAmount(
                    dc.employeeContribution + dc.employerContribution,
                  )}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Portfolio — hidden in zen mode (single portfolio auto-selected). */}
      {showPicker && (
        <div>
          <label
            htmlFor="payslip-portfolio"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {"Portfolio"}
          </label>
          <select
            id="payslip-portfolio"
            value={effectivePortfolioId}
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
      )}

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
          value={effectiveCashAssetId}
          onChange={(e) => setCashAssetId(e.target.value)}
          className="w-full border-gray-300 rounded-md shadow-sm px-3 py-2 border bg-white"
        >
          <option value="">{"Select a cash account..."}</option>
          {accountOptions.length > 0 && (
            <optgroup label="Accounts">
              {accountOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          )}
          {cashOptions.length > 0 && (
            <optgroup label="Cash balances">
              {cashOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          )}
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

      <Dialog.ErrorAlert message={submitError} />
    </Dialog>
  )
}

export default PayslipModal
