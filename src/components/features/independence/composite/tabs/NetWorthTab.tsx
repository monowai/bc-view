import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Portfolio } from "types/beancounter"
import { useActiveIndependencePlan } from "@hooks/useIndependencePlans"
import { useNetWorthData } from "@components/features/wealth/useNetWorthData"
import { useWealthSummary } from "@components/features/wealth/useWealthSummary"
import AssetAllocationCharts from "@components/features/wealth/AssetAllocationCharts"
import PortfolioDetailsTable from "@components/features/wealth/PortfolioDetailsTable"
import Alert from "@components/ui/Alert"
import Spinner from "@components/ui/Spinner"
import { toErrorMessage } from "@lib/formatters"

type SortConfig = {
  key: string | null
  direction: "asc" | "desc"
}

/** Manual asset categories, for an account holding no portfolios. */
const MANUAL_ASSET_CATEGORIES: { key: string; label: string }[] = [
  { key: "CASH", label: "Cash & Bank Accounts" },
  { key: "EQUITY", label: "Stocks & Shares" },
  { key: "ETF", label: "ETFs" },
  { key: "MUTUAL_FUND", label: "Mutual Funds" },
  { key: "RE", label: "Real Estate" },
]

/**
 * How one portfolio is treated by the plan being viewed.
 *
 * `liquidated` is emphatically **not** `excluded`. Selling the house still
 * leaves you the money: svc-retire turns the portfolio's value into spendable
 * cash at t0, less sale costs. Excluding it models never having owned it and
 * quietly loses the whole capital value — the modelling bug this editor
 * exists to make impossible to hit by accident.
 */
type PortfolioTreatment = "included" | "liquidated" | "excluded"

interface TreatmentOption {
  key: PortfolioTreatment
  /** Button text, and the basis of the control's accessible name. */
  label: string
  /** Legend entry — the whole point of the state, in one line. */
  legend: string
  /** Shown under the row once chosen, so the choice keeps explaining itself. */
  caption?: string
  selectedClass: string
}

const TREATMENTS: TreatmentOption[] = [
  {
    key: "included",
    label: "Keep",
    legend: "its value and any income it earns count toward this plan.",
    selectedClass:
      "bg-independence-50 text-independence-700 dark:bg-independence-900/40 dark:text-independence-200",
  },
  {
    key: "liquidated",
    label: "Sell",
    legend:
      "sold at the start; what it is worth, less sale costs, turns into spendable cash.",
    caption: "Sold at the start of this plan. Rental income stops.",
    selectedClass:
      "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200",
  },
  {
    key: "excluded",
    label: "Exclude",
    legend:
      "left out of this plan altogether — none of its value is counted anywhere.",
    caption: "Not part of this plan's wealth at all.",
    selectedClass:
      "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  },
]

/**
 * Seed latch value for "no plan at all" — the tab still renders, it just has
 * nowhere to persist a wealth definition to.
 */
const NO_PLAN = "__no-plan__"

/** Sale costs are a fraction on the wire; the backend rejects outside [0, 1). */
const COSTS_PERCENT_LIMIT = 100

/**
 * Typed values are saved on a trailing edge, not per keystroke. Matches
 * useCompositeProjection's save debounce — typing "12" fired a PATCH for 1
 * and another for 12, both fire-and-forget, so whichever *response* landed
 * last won and the box could disagree with what was stored.
 */
const SAVE_DEBOUNCE_MS = 1000

/** Arrow keys that move the selection within a treatment radiogroup. */
const ARROW_STEP: Record<string, number> = {
  ArrowRight: 1,
  ArrowDown: 1,
  ArrowLeft: -1,
  ArrowUp: -1,
}

function parseJsonStringArray(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as string[]) : []
  } catch {
    return []
  }
}

function parseJsonStringRecord(
  raw: string | null | undefined,
): Record<string, number> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, number>)
      : {}
  } catch {
    return {}
  }
}

/** 0.05 on the wire reads as "5" in the box. */
function costsFractionToPercentInput(fraction: number | undefined): string {
  const percent = (fraction ?? 0) * COSTS_PERCENT_LIMIT
  return String(Math.round(percent * 1e6) / 1e6)
}

const TREATMENT_BUTTON_CLASS =
  "px-3 py-1.5 text-xs font-medium transition-colors duration-150 focus:outline-none focus:ring-1 focus:ring-independence-500 disabled:opacity-50 motion-reduce:transition-none"

/**
 * NetWorthTab — the wealth definition for the independence plan being viewed.
 *
 * Wealth is per plan, not per account: that is the mechanism by which a "No
 * Property" plan drops the house while the plan that keeps it still counts it.
 * Every write lands on the active plan (`PATCH /independence-plans/{id}`), and
 * switching plan re-reads that plan's definition.
 *
 * Holdings scoping: only **excluded** ids leave the aggregated-holdings fetch.
 * A liquidated portfolio is still the user's money — svc-retire converts it to
 * cash — so it stays in `ids=`, otherwise the charts would disagree with the
 * headline. (svc-retire#250: the backend breakdown still reports a real-estate
 * slice for a liquidated portfolio though the totals are right. Known gap —
 * not patched over here.)
 */
export default function NetWorthTab(): React.ReactElement {
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: "value",
    direction: "desc",
  })
  const [collapsedSections, setCollapsedSections] = useState({
    charts: false,
    portfolioDetails: false,
  })

  const { activePlan, activePlanId, update } = useActiveIndependencePlan()

  // Parse the plan's wealth definition early — the excluded list is passed to
  // useNetWorthData so the holdings fetch is scoped to the included ids.
  const excludedIds: string[] = useMemo(
    () => parseJsonStringArray(activePlan?.excludedPortfolioIds),
    [activePlan?.excludedPortfolioIds],
  )
  const liquidatedIds: string[] = useMemo(
    () => parseJsonStringArray(activePlan?.liquidatedPortfolioIds),
    [activePlan?.liquidatedPortfolioIds],
  )
  const excludedSet = useMemo(() => new Set(excludedIds), [excludedIds])
  const liquidatedSet = useMemo(() => new Set(liquidatedIds), [liquidatedIds])

  const [saveError, setSaveError] = useState<string | null>(null)
  const [costsInput, setCostsInput] = useState("0")
  const [costsError, setCostsError] = useState<string | null>(null)
  const [costsSeededFor, setCostsSeededFor] = useState<string | null>(null)

  // Debounced saves for the two typed fields. Each keystroke cancels the
  // pending write, so exactly one PATCH goes out per pause and the last
  // *keystroke* wins rather than the last response to arrive.
  const costsSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const manualAssetsSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  )
  // Edits made while a save is pending, so typing into two categories inside
  // one debounce window doesn't drop the first — `manualAssetsRecord` still
  // reads the plan as the server last returned it.
  const pendingManualAssets = useRef<Record<string, number> | null>(null)

  // A queued write belongs to the plan it was typed into. Keying the cleanup
  // on the plan id cancels it both on unmount and the moment the user switches
  // plan — otherwise a number half-typed against "With Property" would land on
  // "No Property" a second after selecting it. (Refs can't be touched during
  // render, so this can't live in the seeding latch below.)
  useEffect(
    () => () => {
      if (costsSaveTimer.current) clearTimeout(costsSaveTimer.current)
      if (manualAssetsSaveTimer.current)
        clearTimeout(manualAssetsSaveTimer.current)
      pendingManualAssets.current = null
    },
    [activePlanId],
  )

  // Render-phase run-once seeding, latched on the plan id — the same pattern
  // useCompositeProjection uses. Keyed by plan rather than a boolean so
  // switching plan re-reads that plan's sale costs instead of leaving the
  // previous plan's number in the box, where the next keystroke would save it
  // over the plan just selected.
  const seedKey = activePlanId ?? NO_PLAN
  if (costsSeededFor !== seedKey) {
    setCostsInput(
      costsFractionToPercentInput(activePlan?.liquidationCostsPercent),
    )
    setCostsError(null)
    setSaveError(null)
    setCostsSeededFor(seedKey)
  }

  const {
    portfolios,
    holdingsData,
    currencies,
    displayCurrency,
    setDisplayCurrency,
    fxRates,
    customAssetTotals,
    healthcareReserveTotals,
    isLoading,
  } = useNetWorthData(excludedIds)

  // Only exclusions leave the pot. A liquidated portfolio's value still
  // belongs to the user, as cash.
  const includedPortfolios: Portfolio[] = useMemo(
    () => portfolios.filter((p) => !excludedSet.has(p.id)),
    [portfolios, excludedSet],
  )

  const summary = useWealthSummary(
    includedPortfolios,
    fxRates,
    sortConfig,
    holdingsData,
    customAssetTotals,
    healthcareReserveTotals,
  )

  // Gates the manual assets editor — only shown when no balances exist
  const portfoliosWithBalance: Portfolio[] = useMemo(
    () => portfolios.filter((p) => (p.marketValue ?? 0) !== 0),
    [portfolios],
  )

  const manualAssetsRecord: Record<string, number> = useMemo(
    () => parseJsonStringRecord(activePlan?.manualAssets),
    [activePlan?.manualAssets],
  )

  const handleSort = (key: string): void => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === "asc" ? "desc" : "asc" }
      }
      return { key, direction: key === "code" ? "asc" : "desc" }
    })
  }

  const treatmentOf = useCallback(
    (portfolioId: string): PortfolioTreatment => {
      if (excludedSet.has(portfolioId)) return "excluded"
      if (liquidatedSet.has(portfolioId)) return "liquidated"
      return "included"
    },
    [excludedSet, liquidatedSet],
  )

  /**
   * Both arrays are rewritten on every change, so a portfolio can never sit in
   * both. Enforced here rather than trusted to the server.
   */
  const applyTreatment = (
    portfolioId: string,
    treatment: PortfolioTreatment,
  ): void => {
    if (!activePlanId || treatmentOf(portfolioId) === treatment) return
    const nextExcluded = excludedIds.filter((id) => id !== portfolioId)
    const nextLiquidated = liquidatedIds.filter((id) => id !== portfolioId)
    if (treatment === "excluded") nextExcluded.push(portfolioId)
    if (treatment === "liquidated") nextLiquidated.push(portfolioId)
    setSaveError(null)
    update(activePlanId, {
      excludedPortfolioIds: JSON.stringify(nextExcluded),
      liquidatedPortfolioIds: JSON.stringify(nextLiquidated),
    }).catch((e) =>
      setSaveError(toErrorMessage(e, "Failed to save this plan's wealth")),
    )
  }

  const handleCostsChange = (raw: string): void => {
    setCostsInput(raw)
    // Cancel first, unconditionally: clearing the box or typing something
    // invalid must also call off the write the previous keystroke queued.
    if (costsSaveTimer.current) clearTimeout(costsSaveTimer.current)
    if (raw.trim() === "") {
      setCostsError(null)
      return
    }
    const percent = Number(raw)
    if (
      !Number.isFinite(percent) ||
      percent < 0 ||
      percent >= COSTS_PERCENT_LIMIT
    ) {
      setCostsError("Sale costs must be at least 0% and under 100%.")
      return
    }
    setCostsError(null)
    if (!activePlanId) return
    const planId = activePlanId
    costsSaveTimer.current = setTimeout(() => {
      update(planId, {
        liquidationCostsPercent: percent / COSTS_PERCENT_LIMIT,
      }).catch((e) =>
        setCostsError(toErrorMessage(e, "Failed to save sale costs")),
      )
    }, SAVE_DEBOUNCE_MS)
  }

  const handleManualAssetChange = (key: string, value: number): void => {
    if (!activePlanId) return
    const planId = activePlanId
    const next = {
      ...(pendingManualAssets.current ?? manualAssetsRecord),
      [key]: value,
    }
    pendingManualAssets.current = next
    setSaveError(null)
    if (manualAssetsSaveTimer.current)
      clearTimeout(manualAssetsSaveTimer.current)
    manualAssetsSaveTimer.current = setTimeout(() => {
      pendingManualAssets.current = null
      update(planId, { manualAssets: JSON.stringify(next) }).catch((e) =>
        setSaveError(toErrorMessage(e, "Failed to save estimated assets")),
      )
    }, SAVE_DEBOUNCE_MS)
  }

  /**
   * Arrow-key navigation for a treatment radiogroup (ARIA radio-group
   * pattern): one tab stop into the group — the checked button — with the
   * arrows moving focus *and* selection, wrapping at both ends.
   */
  const handleTreatmentKeyDown = (
    e: React.KeyboardEvent<HTMLButtonElement>,
    portfolioId: string,
    index: number,
  ): void => {
    const step = ARROW_STEP[e.key]
    if (!step) return
    e.preventDefault()
    const nextIndex = (index + step + TREATMENTS.length) % TREATMENTS.length
    // The buttons are the radiogroup's only children, in TREATMENTS order.
    const next = e.currentTarget.parentElement?.children[nextIndex]
    if (next instanceof HTMLElement) next.focus()
    applyTreatment(portfolioId, TREATMENTS[nextIndex].key)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner label="Loading wealth data..." size="lg" />
      </div>
    )
  }

  return (
    <div>
      {/* Per-plan scope notice */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
        <i className="fas fa-wallet text-blue-500 mt-0.5 shrink-0"></i>
        <div>
          <p className="text-sm font-medium text-blue-800">
            Wealth for {activePlan?.name ?? "this plan"}
          </p>
          <p className="text-sm text-blue-700 mt-0.5">
            Each plan carries its own definition of wealth and drives the FI
            gauge across that plan&apos;s phases. What you change here applies
            to this plan only.
          </p>
        </div>
      </div>

      {saveError && (
        <div className="mb-6">
          <Alert>{saveError}</Alert>
        </div>
      )}

      {/* Portfolio treatment editor — primary content */}
      {portfolios.length > 0 && (
        <div className="mb-6 bg-white rounded-xl shadow-md overflow-hidden dark:bg-gray-900">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              How each portfolio counts in this plan
            </h3>
            <ul className="mt-2 space-y-1 text-sm text-gray-500 dark:text-gray-400">
              {TREATMENTS.map((option) => (
                <li key={option.key}>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {option.label}
                  </span>{" "}
                  — {option.legend}
                </li>
              ))}
            </ul>
          </div>
          <div className="px-6 py-4 space-y-2">
            {portfolios.map((portfolio) => {
              const treatment = treatmentOf(portfolio.id)
              const caption = TREATMENTS.find(
                (option) => option.key === treatment,
              )?.caption
              return (
                <div
                  key={portfolio.id}
                  className="p-3 bg-gray-50 rounded-lg dark:bg-gray-800"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex-1 min-w-[10rem]">
                      <span className="font-medium text-gray-900 dark:text-gray-100">
                        {portfolio.code}
                      </span>
                      <span className="text-gray-500 ml-2 dark:text-gray-400">
                        {portfolio.name}
                      </span>
                    </div>
                    <span className="text-gray-700 font-medium text-sm dark:text-gray-300">
                      {portfolio.base?.code}{" "}
                      {Math.round(portfolio.marketValue || 0).toLocaleString()}
                    </span>
                    {/* Buttons carrying the radio role, not labels wrapping
                        inputs — the wrapped form double-fires. Roving
                        tabindex: Tab reaches the group once, landing on the
                        checked option, and the arrows move from there. */}
                    <div
                      role="radiogroup"
                      aria-label={`How ${portfolio.code} counts in this plan`}
                      className="inline-flex shrink-0 divide-x divide-gray-200 overflow-hidden rounded-md border border-gray-200 dark:divide-gray-700 dark:border-gray-700"
                    >
                      {TREATMENTS.map((option, optionIndex) => {
                        const selected = option.key === treatment
                        return (
                          <button
                            key={option.key}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            aria-label={`${option.label} ${portfolio.code}`}
                            tabIndex={selected ? 0 : -1}
                            disabled={!activePlanId}
                            onClick={() =>
                              applyTreatment(portfolio.id, option.key)
                            }
                            onKeyDown={(e) =>
                              handleTreatmentKeyDown(
                                e,
                                portfolio.id,
                                optionIndex,
                              )
                            }
                            className={`${TREATMENT_BUTTON_CLASS} ${
                              selected
                                ? option.selectedClass
                                : "bg-white text-gray-500 hover:text-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                            }`}
                          >
                            {option.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  {caption && (
                    <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                      {caption}
                    </p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Sale costs — only meaningful once something is being sold */}
          {liquidatedIds.length > 0 && (
            <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800">
              <label
                htmlFor="liquidation-costs-percent"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                Sale costs
              </label>
              <div className="relative mt-1 w-32">
                <input
                  id="liquidation-costs-percent"
                  type="number"
                  min={0}
                  max={99.99}
                  step={0.5}
                  value={costsInput}
                  onChange={(e) => handleCostsChange(e.target.value)}
                  disabled={!activePlanId}
                  className="w-full pl-3 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
                />
                <span className="absolute right-3 top-2.5 text-gray-500 pointer-events-none dark:text-gray-400">
                  %
                </span>
              </div>
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                Agent fees, legal and tax, taken off the proceeds before they
                become cash. Leaving this at 0% flatters every plan that sells
                something.
              </p>
              {costsError && <Alert className="mt-2">{costsError}</Alert>}
            </div>
          )}
        </div>
      )}

      {/* Breakdown section header with compact currency selector */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Wealth Breakdown
        </h3>
        {currencies.length > 1 && displayCurrency && (
          <select
            value={displayCurrency.code}
            onChange={(e) => {
              const found = currencies.find((c) => c.code === e.target.value)
              if (found) setDisplayCurrency(found)
            }}
            className="text-sm border border-gray-300 rounded px-2 py-1 text-gray-700 focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
            aria-label="Display currency"
          >
            {currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Classification breakdown */}
      <AssetAllocationCharts
        summary={summary}
        holdings={holdingsData}
        fxRates={fxRates}
        displayCurrency={displayCurrency}
        collapsed={collapsedSections.charts}
        onToggle={() =>
          setCollapsedSections((prev) => ({
            ...prev,
            charts: !prev.charts,
          }))
        }
      />

      {/* Per-portfolio breakdown */}
      {includedPortfolios.length > 1 && (
        <PortfolioDetailsTable
          summary={summary}
          sortConfig={sortConfig}
          onSort={handleSort}
          displayCurrency={displayCurrency}
          collapsed={collapsedSections.portfolioDetails}
          onToggle={() =>
            setCollapsedSections((prev) => ({
              ...prev,
              portfolioDetails: !prev.portfolioDetails,
            }))
          }
        />
      )}

      {/* Manual asset estimates — only when no portfolio balances exist */}
      {portfoliosWithBalance.length === 0 && (
        <div className="mt-6 bg-white rounded-xl shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">
              Estimated Assets
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              No portfolio balances found. Enter estimated values to drive the
              FI gauge for this plan while you set up your portfolios.
            </p>
          </div>
          <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            {MANUAL_ASSET_CATEGORIES.map((cat) => (
              <div key={cat.key}>
                <label
                  htmlFor={`manual-asset-${cat.key}`}
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {cat.label}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-gray-500 pointer-events-none">
                    $
                  </span>
                  <input
                    id={`manual-asset-${cat.key}`}
                    type="number"
                    min={0}
                    step={1000}
                    value={manualAssetsRecord[cat.key] || 0}
                    onChange={(e) =>
                      handleManualAssetChange(
                        cat.key,
                        Number(e.target.value) || 0,
                      )
                    }
                    className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
