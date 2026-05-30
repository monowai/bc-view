import React, { useState } from "react"
import type { FiMetrics as FiMetricsType } from "types/independence"
import InfoTooltip from "@components/ui/Tooltip"
import PrivateCurrency, {
  PrivatePercentage,
  HIDDEN_VALUE,
} from "@components/ui/PrivateCurrency"
import { usePrivacyMode } from "@hooks/usePrivacyMode"
import {
  calculateFiProgress,
  calculateGapToFi,
  calculateFiNumberFromMonthly,
  isFinanciallyIndependent,
  clampFiProgress,
  calculateCoastFiNumber,
  calculateCoastFiProgress,
  isCoastFireAchieved,
  calculateYearsToTarget,
  calculateSavingsRate,
  calculateBlendedReturnRate,
  calculateRealReturnRate,
} from "@utils/independence/fiCalculations"
import {
  getProgressBgColor,
  getProgressTextColor,
  getGapColorScheme,
  getSavingsRateTextColor,
} from "@utils/independence/fiColorThemes"
import FiAgeExplorer from "./FiAgeExplorer"

interface FiMetricsProps {
  /** Monthly expenses in retirement */
  monthlyExpenses: number
  /** Liquid (spendable) assets */
  liquidAssets: number
  /** Currency code (e.g., "NZD") */
  currency: string
  /** Monthly income during working years */
  workingIncomeMonthly?: number
  /** Monthly investment amount (pre-calculated from plan) */
  monthlyInvestment?: number
  /** Expected annual return rate (as decimal, e.g., 0.07 for 7%) */
  expectedReturnRate?: number
  /** Current age (for Coast FIRE calculation) */
  currentAge?: number
  /** Target retirement age (for Coast FIRE calculation) */
  retirementAge?: number
  /**
   * Backend-calculated FI metrics. Overrides local calculations field-by-field
   * when present; falls back to local computation per field when fiMetrics is
   * absent or a particular field is missing. Single grouped prop instead of
   * dozens of backendX scalars.
   */
  backendFiMetrics?: FiMetricsType
  /**
   * Effective primary strategy ("FIRE" | "PENSION" | "HYBRID") used to
   * highlight the relevant section of the panel. When omitted no section is
   * highlighted.
   */
  effectiveStrategy?: "FIRE" | "PENSION" | "HYBRID"
  /** Current inflation rate from plan (as decimal) */
  inflationRate?: number
  /** Current equity return rate from plan (as decimal) */
  equityReturnRate?: number
  /** Current cash return rate from plan (as decimal) */
  cashReturnRate?: number
  /** Current equity allocation from plan (as decimal) */
  equityAllocation?: number
  /** Current cash allocation from plan (as decimal) */
  cashAllocation?: number
}

/**
 * Calculates and displays FIRE (Financial Independence, Retire Early) metrics:
 * - FI Number: 25× annual expenses (based on 4% safe withdrawal rate)
 * - Savings Rate: percentage of income saved during working years
 * - FI Progress: percentage towards financial independence
 * - Estimated years to FI based on current trajectory
 * - Coast FIRE Number: amount needed now to reach FI by retirement through growth alone
 */
export default function FiMetrics({
  monthlyExpenses,
  liquidAssets,
  currency,
  workingIncomeMonthly,
  monthlyInvestment,
  expectedReturnRate = 0.07,
  currentAge,
  retirementAge,
  backendFiMetrics,
  effectiveStrategy,
  inflationRate = 0.025,
  equityReturnRate = 0.08,
  cashReturnRate = 0.03,
  equityAllocation = 0.8,
  cashAllocation = 0.2,
}: FiMetricsProps): React.ReactElement {
  // Per-field aliases keep the rendering code below readable. All fall back
  // to undefined when the backend hasn't computed a value; the render path
  // already handles that with local-calculation fallbacks where it matters.
  const {
    fiNumber: backendFiNumber,
    fiProgress: backendFiProgress,
    netMonthlyExpenses: backendNetMonthlyExpenses,
    coastFiNumber: backendCoastFiNumber,
    coastFiProgress: backendCoastFiProgress,
    isCoastFire: backendIsCoastFire,
    realYearsToFi: backendRealYearsToFi,
    realReturnBelowSwr: backendRealReturnBelowSwr,
    retirementAgeFiProgress: backendRetirementAgeFiProgress,
    bridgeYears: backendBridgeYears,
    bridgeYearsNeeded: backendBridgeYearsNeeded,
    bridgeProgress: backendBridgeProgress,
    incomeCoverageAtRetirement: backendIncomeCoverageAtRetirement,
  } = backendFiMetrics ?? {}
  const { hideValues } = usePrivacyMode()

  // FI Number = Annual Expenses × 25 (based on 4% SWR)
  // Use backend value if provided for consistency with PlanCard
  const localFiNumber = calculateFiNumberFromMonthly(monthlyExpenses)
  const fiNumber = backendFiNumber || localFiNumber

  // FI Progress and Gap - use shared utilities
  // Using || fallback to local calculation when backend returns 0
  const localFiProgress = calculateFiProgress(liquidAssets, fiNumber)
  const fiProgress = backendFiProgress || localFiProgress
  const fiProgressClamped = clampFiProgress(fiProgress)
  const isFi = isFinanciallyIndependent(fiProgress)

  // Always calculate Gap locally to ensure What-If changes are reflected
  const gapToFi = calculateGapToFi(fiNumber, liquidAssets)
  const gapColors = getGapColorScheme(gapToFi)

  // Savings Rate
  const savingsRate = calculateSavingsRate(
    monthlyInvestment ?? 0,
    workingIncomeMonthly ?? 0,
  )

  // Calculate estimated years to FI using compound interest formula
  const yearsToFi = calculateYearsToFiLocal(
    liquidAssets,
    (monthlyInvestment || 0) * 12,
    fiNumber,
    expectedReturnRate,
  )

  // Coast FIRE calculations
  const yearsToRetirement = calculateYearsToTarget(currentAge, retirementAge)
  const localCoastFiNumber = calculateCoastFiNumber(
    fiNumber,
    yearsToRetirement ?? 0,
    expectedReturnRate,
  )
  const coastFiNumber = backendCoastFiNumber ?? localCoastFiNumber
  const localCoastFiProgress = calculateCoastFiProgress(
    liquidAssets,
    coastFiNumber,
  )
  const coastFiProgress = backendCoastFiProgress ?? localCoastFiProgress
  const isCoastFire = backendIsCoastFire ?? isCoastFireAchieved(coastFiProgress)

  // Calculate real return rate for FI Age Explorer
  const blendedReturn = calculateBlendedReturnRate(
    cashReturnRate,
    equityReturnRate,
    cashAllocation,
    equityAllocation,
  )
  const realReturnRate = calculateRealReturnRate(blendedReturn, inflationRate)

  // Auto-detected strategy visibility — each user pursues one or a mix of
  // these. Hide a section when its strategy doesn't apply to this plan.
  const hasGuaranteedIncome =
    (backendIncomeCoverageAtRetirement ?? 0) > 0 ||
    (backendRetirementAgeFiProgress ?? 0) > 0
  const autoPensionEligible = hasGuaranteedIncome
  const autoBridgeEligible =
    hasGuaranteedIncome &&
    backendBridgeProgress != null &&
    backendBridgeYears != null &&
    backendBridgeYearsNeeded != null &&
    backendBridgeYearsNeeded > 0

  // Session-only view override. Lets the user inspect any single strategy or
  // ALL of them, regardless of the auto-detect rules. Not persisted.
  const [viewOverride, setViewOverride] = useState<
    "auto" | "FIRE" | "PENSION" | "HYBRID" | "ALL"
  >("auto")

  const showFire =
    viewOverride === "auto" || viewOverride === "ALL" || viewOverride === "FIRE"
  const showPension =
    viewOverride === "ALL" ||
    viewOverride === "PENSION" ||
    (viewOverride === "auto" && autoPensionEligible)
  const showBridge =
    viewOverride === "ALL" ||
    viewOverride === "HYBRID" ||
    (viewOverride === "auto" && autoBridgeEligible)

  // Active badge tracks the effective (real) strategy, even when the user is
  // peeking at a different view — so the original picture isn't lost.
  const fireActive = effectiveStrategy === "FIRE"
  const pensionActive = effectiveStrategy === "PENSION"
  const bridgeActive = effectiveStrategy === "HYBRID"

  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          Retirement Strategies
          <InfoTooltip text="Each user pursues one or more of three paths: FIRE (live off liquid investments), Pension (rely on guaranteed income), or Bridge (use liquid to cover the gap until pensions start). Auto picks based on your plan; override to inspect a different view.">
            <span></span>
          </InfoTooltip>
        </h2>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          <span>View:</span>
          <select
            value={viewOverride}
            onChange={(e) =>
              setViewOverride(
                e.target.value as
                  | "auto"
                  | "FIRE"
                  | "PENSION"
                  | "HYBRID"
                  | "ALL",
              )
            }
            className="px-2 py-1 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-independence-500"
            aria-label="View strategy"
          >
            <option value="auto">Auto</option>
            <option value="FIRE">FIRE</option>
            <option value="PENSION">Pension</option>
            <option value="HYBRID">Bridge</option>
            <option value="ALL">All</option>
          </select>
        </label>
      </div>

      <div className="space-y-4">
        {showFire && (
          <>
            <StrategyHeader
              title="FIRE Strategy"
              tooltip="Financial Independence, Retire Early. Measures how far your liquid (spendable) investments carry you using the 4% safe withdrawal rate (25× expenses)."
              iconClass="fas fa-fire text-orange-500"
              active={fireActive}
            />

            {/* FI Number */}
            <div className="p-4 bg-linear-to-r from-independence-50 to-independence-100 rounded-lg border border-independence-100">
              <div className="flex justify-between items-center">
                <div>
                  <InfoTooltip text="Your FI Number is 25× your annual expenses. At this amount, a 4% annual withdrawal covers your expenses indefinitely.">
                    <span className="text-sm text-gray-600 flex items-center gap-1">
                      <i className="fas fa-bullseye text-independence-500"></i>
                      FI Number (25×)
                    </span>
                  </InfoTooltip>
                </div>
                <span className="text-xl font-bold text-independence-600">
                  <PrivateCurrency
                    value={fiNumber}
                    currency={currency}
                    hideValues={hideValues}
                  />
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {hideValues ? (
                  <>Based on {HIDDEN_VALUE}/mo × 12 × 25</>
                ) : (
                  <>
                    Based on {currency}
                    {Math.round(
                      backendNetMonthlyExpenses ?? monthlyExpenses,
                    ).toLocaleString()}
                    /mo net expenses × 12 × 25
                  </>
                )}
              </p>
            </div>

            {/* FI Progress Bar */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <InfoTooltip text="Progress toward Financial Independence based on liquid (spendable) assets only. The Pension-Saver View below adds gauges that credit locked retirement-fund assets.">
                  <span className="text-sm text-gray-600">
                    Early Retirement Progress
                  </span>
                </InfoTooltip>
                <PrivatePercentage
                  value={fiProgress}
                  hideValues={hideValues}
                  className={`font-semibold ${getProgressTextColor(fiProgress)}`}
                />
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full ${getProgressBgColor(fiProgress)} transition-all duration-500`}
                  style={{ width: hideValues ? "0%" : `${fiProgressClamped}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <PrivateCurrency
                  value={liquidAssets}
                  currency={currency}
                  hideValues={hideValues}
                />
                <PrivateCurrency
                  value={fiNumber}
                  currency={currency}
                  hideValues={hideValues}
                />
              </div>
              {/* Gap/Surplus to FI */}
              <div
                className={`flex justify-between items-center mt-3 p-2 rounded-lg ${gapColors.bg}`}
              >
                <InfoTooltip
                  text={
                    gapToFi <= 0
                      ? "You have exceeded your FI Number!"
                      : "The amount still needed to reach your FI Number"
                  }
                >
                  <span className="text-sm text-gray-600 flex items-center gap-1">
                    <i className={`fas ${gapColors.icon}`}></i>
                    {gapToFi <= 0 ? "FI Surplus" : "Gap to FI"}
                  </span>
                </InfoTooltip>
                <span className={`font-semibold ${gapColors.text}`}>
                  {hideValues ? (
                    HIDDEN_VALUE
                  ) : (
                    <>
                      {gapToFi <= 0 ? "+" : ""}
                      {currency}
                      {Math.round(Math.abs(gapToFi)).toLocaleString()}
                    </>
                  )}
                </span>
              </div>
            </div>

            {/* Years to FI */}
            {yearsToFi !== null && yearsToFi > 0 && !isFi && (
              <div className="py-2 border-t border-gray-100">
                <div className="flex justify-between items-center">
                  <InfoTooltip text="Estimated years until you reach your FI Number using nominal returns. The 'real' value uses inflation-adjusted returns (matches online FIRE calculators).">
                    <span className="text-gray-600 flex items-center gap-2">
                      <i className="fas fa-calendar-alt text-blue-500"></i>
                      Years to FI
                      {currentAge && (
                        <span className="text-xs text-gray-400">
                          (age {currentAge} →{" "}
                          {currentAge +
                            Math.round(backendRealYearsToFi ?? yearsToFi)}
                          )
                        </span>
                      )}
                    </span>
                  </InfoTooltip>
                  <span className="font-semibold text-gray-900">
                    {hideValues
                      ? HIDDEN_VALUE
                      : backendRealYearsToFi
                        ? backendRealYearsToFi <= 1
                          ? "< 1 year"
                          : `~${Math.round(backendRealYearsToFi)} years`
                        : yearsToFi <= 1
                          ? "< 1 year"
                          : `~${Math.round(yearsToFi)} years`}
                  </span>
                </div>
                {backendRealYearsToFi && !hideValues && (
                  <p className="text-xs text-gray-500 mt-1">
                    Using inflation-adjusted returns (nominal: ~
                    {Math.round(yearsToFi)} years)
                  </p>
                )}
              </div>
            )}

            {/* Coast FIRE */}
            {coastFiNumber !== null &&
              !isFi &&
              retirementAge &&
              yearsToRetirement &&
              yearsToRetirement > 0 && (
                <div className="py-3 border-t border-gray-100">
                  <div className="flex justify-between items-center mb-2">
                    <InfoTooltip text="Coast FIRE is the amount you need invested today so that compound growth alone (no more contributions) will reach your FI Number by your retirement age.">
                      <span className="text-gray-600 flex items-center gap-2">
                        <i className="fas fa-ship text-purple-500"></i>
                        Coast FI Number
                      </span>
                    </InfoTooltip>
                    <span className="font-semibold text-purple-600">
                      <PrivateCurrency
                        value={coastFiNumber}
                        currency={currency}
                        hideValues={hideValues}
                      />
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">
                      Coast FI Progress ({yearsToRetirement}yr to retirement,
                      age {retirementAge})
                    </span>
                    <span
                      className={`font-medium ${hideValues ? "text-gray-400" : isCoastFire ? "text-purple-600" : "text-gray-600"}`}
                    >
                      {hideValues
                        ? HIDDEN_VALUE
                        : `${coastFiProgress?.toFixed(1)}%`}
                    </span>
                  </div>
                  {!hideValues && !isCoastFire && currentAge && (
                    <p className="text-xs text-gray-500 mt-1">
                      You have {currency}
                      {Math.round(liquidAssets).toLocaleString()} of {currency}
                      {Math.round(coastFiNumber).toLocaleString()} needed to
                      coast to FI by age {retirementAge}
                    </p>
                  )}
                  {isCoastFire && !hideValues && currentAge && (
                    <div className="mt-2 p-2 bg-purple-50 rounded-lg border border-purple-200">
                      <div className="flex items-center gap-2 text-purple-700 text-sm">
                        <i className="fas fa-anchor"></i>
                        <span className="font-medium">
                          Coast FIRE Achieved!
                        </span>
                      </div>
                      <p className="text-xs text-purple-600 mt-1">
                        You could stop contributing now and still reach FI by
                        age {retirementAge} through investment growth alone.
                      </p>
                    </div>
                  )}
                </div>
              )}

            {/* SWR Warning */}
            {backendRealReturnBelowSwr && !hideValues && !isFi && (
              <div className="mt-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <div className="flex items-center gap-2 text-amber-700">
                  <i className="fas fa-exclamation-triangle"></i>
                  <span className="font-medium">Low Real Return Warning</span>
                </div>
                <p className="text-xs text-amber-600 mt-1">
                  Your real return (after inflation) is below the 4% safe
                  withdrawal rate. This means traditional FIRE calculations may
                  be optimistic. Consider increasing returns, reducing expenses,
                  or planning for a longer working period.
                </p>
              </div>
            )}

            {/* FI Achieved */}
            {isFi && !hideValues && (
              <div className="mt-2 p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 text-green-700">
                  <i className="fas fa-check-circle"></i>
                  <span className="font-medium">Financially Independent!</span>
                </div>
                <p className="text-xs text-green-600 mt-1">
                  Your liquid assets exceed your FI Number. You could sustain
                  your lifestyle indefinitely using the 4% rule.
                </p>
              </div>
            )}

            {/* Savings Rate - informational, doesn't affect FIRE calculations */}
            {savingsRate !== null && (
              <div className="flex justify-between items-center py-2 border-t border-gray-100">
                <InfoTooltip text="The percentage of your working income that goes towards savings/investments. Higher savings rates lead to faster FI.">
                  <span className="text-gray-600 flex items-center gap-2">
                    <i className="fas fa-piggy-bank text-green-500"></i>
                    Savings Rate
                  </span>
                </InfoTooltip>
                <div className="text-right">
                  <PrivatePercentage
                    value={savingsRate}
                    hideValues={hideValues}
                    className={`font-semibold ${hideValues ? "text-gray-400" : getSavingsRateTextColor(savingsRate)}`}
                  />
                  {monthlyInvestment !== undefined && (
                    <div className="text-xs text-gray-500">
                      {hideValues ? (
                        HIDDEN_VALUE
                      ) : (
                        <>
                          {currency}
                          {Math.round(monthlyInvestment).toLocaleString()}/mo
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* FI Age Explorer */}
            {!isFi &&
              currentAge &&
              workingIncomeMonthly &&
              workingIncomeMonthly > 0 &&
              !hideValues && (
                <FiAgeExplorer
                  liquidAssets={liquidAssets}
                  fiNumber={fiNumber}
                  currentAge={currentAge}
                  monthlyInvestment={monthlyInvestment || 0}
                  workingIncomeMonthly={workingIncomeMonthly}
                  realReturnRate={realReturnRate}
                  currency={currency}
                />
              )}
          </>
        )}

        {showPension && (
          <PensionStrategySection
            retirementAgeFiProgress={backendRetirementAgeFiProgress}
            incomeCoverage={backendIncomeCoverageAtRetirement}
            isClassicFi={isFi}
            active={pensionActive}
            hideValues={hideValues}
          />
        )}

        {showBridge && (
          <BridgeStrategySection
            bridgeYears={backendBridgeYears ?? 0}
            bridgeYearsNeeded={backendBridgeYearsNeeded ?? 0}
            bridgeProgress={backendBridgeProgress ?? 0}
            active={bridgeActive}
            hideValues={hideValues}
          />
        )}
      </div>
    </div>
  )
}

interface StrategyHeaderProps {
  title: string
  tooltip: string
  iconClass: string
  /** When true, render an "Active" badge — used to highlight the effective strategy. */
  active?: boolean
}

function StrategyHeader({
  title,
  tooltip,
  iconClass,
  active,
}: StrategyHeaderProps): React.ReactElement {
  return (
    <div className="flex items-center justify-between">
      <InfoTooltip text={tooltip}>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
          <i className={iconClass}></i>
          {title}
        </h3>
      </InfoTooltip>
      {active && (
        <span className="text-xs bg-independence-100 text-independence-700 px-2 py-0.5 rounded-full font-medium">
          Active
        </span>
      )}
    </div>
  )
}

interface PensionStrategySectionProps {
  retirementAgeFiProgress?: number
  incomeCoverage?: number
  isClassicFi: boolean
  active?: boolean
  hideValues: boolean
}

/**
 * Pension Strategy: how well guaranteed income (pension / social security /
 * policy maturity / rental) progresses toward funding retirement. Shown only
 * when the plan actually has guaranteed income configured.
 */
function PensionStrategySection({
  retirementAgeFiProgress,
  incomeCoverage,
  isClassicFi,
  active,
  hideValues,
}: PensionStrategySectionProps): React.ReactElement {
  const gauges: PensionGaugeProps[] = []

  if (retirementAgeFiProgress != null) {
    gauges.push({
      key: "retirement-age-fi",
      label: "Retirement-Age FI",
      tooltip:
        "Adds the present value of guaranteed pension/policy income (discounted to today) to your liquid pot before comparing against the FI Number.",
      value: retirementAgeFiProgress,
      hideValues,
      format: (v) => `${v.toFixed(1)}%`,
    })
  }

  if (incomeCoverage != null) {
    gauges.push({
      key: "income-coverage",
      label: "Income Coverage",
      tooltip:
        "Share of monthly expenses that your guaranteed income (pension + social security + other + rental) will cover from your retirement age onward.",
      value: incomeCoverage,
      hideValues,
      format: (v) => `${v.toFixed(1)}%`,
    })
  }

  const sorted = [...gauges].sort((a, b) => b.value - a.value)
  const showAchievement =
    !isClassicFi &&
    !hideValues &&
    retirementAgeFiProgress != null &&
    retirementAgeFiProgress >= 100

  return (
    <div className="pt-4 border-t border-gray-100 space-y-3">
      <StrategyHeader
        title="Pension Strategy"
        tooltip="For savers whose retirement is funded by guaranteed income streams (CPF LIFE, defined-benefit pensions, policy maturities, rental income). Measures how close that income gets to covering expenses."
        iconClass="fas fa-piggy-bank text-purple-500"
        active={active}
      />

      {sorted.length === 0 ? (
        <p className="text-sm text-gray-500 italic">
          No pension or guaranteed income configured for this plan.
        </p>
      ) : (
        sorted.map(({ key, ...rest }) => <PensionGauge key={key} {...rest} />)
      )}

      {showAchievement && (
        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
          <div className="flex items-center gap-2 text-green-700">
            <i className="fas fa-piggy-bank"></i>
            <span className="font-medium">On Track for FI at Retirement</span>
          </div>
          <p className="text-xs text-green-600 mt-1">
            Your liquid assets plus the present value of your guaranteed pension
            income already meet your FI Number. You may not be able to retire
            early on liquid assets alone, but your full retirement is funded.
          </p>
        </div>
      )}
    </div>
  )
}

interface BridgeStrategySectionProps {
  bridgeYears: number
  bridgeYearsNeeded: number
  bridgeProgress: number
  active?: boolean
  hideValues: boolean
}

/**
 * Bridge Strategy: liquid runway covering the gap between today and pension
 * payout age. Shown only when the user has both guaranteed income (a pension
 * to bridge to) and working-years remaining.
 */
function BridgeStrategySection({
  bridgeYears,
  bridgeYearsNeeded,
  bridgeProgress,
  active,
  hideValues,
}: BridgeStrategySectionProps): React.ReactElement {
  const hasData = bridgeYearsNeeded > 0
  return (
    <div className="pt-4 border-t border-gray-100 space-y-3">
      <StrategyHeader
        title="Bridge Strategy"
        tooltip="For savers whose pension covers retirement but who want to stop working before pensions start. Measures how many years of expenses your liquid pot can carry until the pension kicks in."
        iconClass="fas fa-bridge text-blue-500"
        active={active}
      />

      {hasData ? (
        <PensionGauge
          label="Bridge to Pension"
          tooltip={`Years of full expenses your liquid pot covers, capped at the ${bridgeYearsNeeded}-year gap to your pension payout age. 100% means you could stop working today and ride the bridge to your pension.`}
          value={bridgeProgress}
          hideValues={hideValues}
          format={() =>
            `${bridgeYears.toFixed(1)} / ${bridgeYearsNeeded} years`
          }
        />
      ) : (
        <p className="text-sm text-gray-500 italic">
          No pension to bridge to, or no working-years gap. Configure pension
          income on the plan to enable this view.
        </p>
      )}
    </div>
  )
}

interface PensionGaugeProps {
  /** Stable identifier used for React list keys, not consumed by the component itself. */
  key: string
  label: string
  tooltip: string
  value: number
  hideValues: boolean
  format: (value: number) => string
}

type PensionGaugeRenderProps = Omit<PensionGaugeProps, "key">

function PensionGauge({
  label,
  tooltip,
  value,
  hideValues,
  format,
}: PensionGaugeRenderProps): React.ReactElement {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <InfoTooltip text={tooltip}>
          <span className="text-sm text-gray-600">{label}</span>
        </InfoTooltip>
        <span
          className={`text-sm font-semibold ${getProgressTextColor(value)}`}
        >
          {hideValues ? HIDDEN_VALUE : format(value)}
        </span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${getProgressBgColor(value)} transition-all duration-500`}
          style={{ width: hideValues ? "0%" : `${clamped}%` }}
        />
      </div>
    </div>
  )
}

/**
 * Calculate years to reach FI using binary search with compound interest.
 * FV = PV(1+r)^n + PMT × ((1+r)^n - 1) / r
 * Returns null if FI is not achievable.
 */
function calculateYearsToFiLocal(
  currentAssets: number,
  annualContribution: number,
  targetAmount: number,
  annualReturnRate: number,
): number | null {
  if (currentAssets >= targetAmount) return 0
  if (annualContribution <= 0 && currentAssets <= 0) return null

  if (annualReturnRate <= 0) {
    if (annualContribution <= 0) return null
    return (targetAmount - currentAssets) / annualContribution
  }

  // Binary search for years to reach target
  let low = 0
  let high = 100
  const tolerance = 0.1

  while (high - low > tolerance) {
    const mid = (low + high) / 2
    const fv = calculateFutureValue(
      currentAssets,
      annualContribution,
      annualReturnRate,
      mid,
    )

    if (fv < targetAmount) {
      low = mid
    } else {
      high = mid
    }
  }

  if (low >= 99.9) return null
  return (low + high) / 2
}

/**
 * Calculate future value with compound interest and regular contributions.
 */
function calculateFutureValue(
  presentValue: number,
  annualContribution: number,
  annualRate: number,
  years: number,
): number {
  const compoundFactor = Math.pow(1 + annualRate, years)
  const fvPresent = presentValue * compoundFactor
  const fvContributions =
    annualRate > 0
      ? annualContribution * ((compoundFactor - 1) / annualRate)
      : annualContribution * years

  return fvPresent + fvContributions
}
