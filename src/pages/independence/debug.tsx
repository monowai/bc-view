import React, { useEffect, useMemo, useState } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import Head from "next/head"
import Link from "next/link"
import useSwr from "swr"
import { simpleFetcher, holdingKey } from "@utils/api/fetchHelper"
import {
  PlansResponse,
  ProjectionResponse,
  RetirementPlan,
  RetirementProjection,
} from "types/independence"
import { HoldingContract } from "types/beancounter"
import { useAssetBreakdown } from "@components/features/independence"
import Spinner from "@components/ui/Spinner"
import Alert from "@components/ui/Alert"

const plansKey = "/api/independence/plans"
const PROJECTION_DEBOUNCE_MS = 300

interface Sliders {
  currentAge: number
  retirementAge: number
  lifeExpectancy: number
  liquidAssets: number
  monthlyExpenses: number
  pensionMonthly: number
  socialSecurityMonthly: number
  otherIncomeMonthly: number
  equityReturnRate: number
  inflationRate: number
}

function planToSliders(
  plan: RetirementPlan,
  liquidFromAssets: number,
): Sliders {
  const currentYear = new Date().getFullYear()
  const currentAge = plan.yearOfBirth ? currentYear - plan.yearOfBirth : 50
  const retirementAge = Math.min(
    plan.lifeExpectancy - 1,
    Math.max(currentAge + 1, currentAge + 5),
  )
  return {
    currentAge,
    retirementAge,
    lifeExpectancy: plan.lifeExpectancy,
    liquidAssets: Math.round(liquidFromAssets),
    monthlyExpenses: plan.monthlyExpenses,
    pensionMonthly: plan.pensionMonthly,
    socialSecurityMonthly: plan.socialSecurityMonthly,
    otherIncomeMonthly: plan.otherIncomeMonthly,
    equityReturnRate: plan.equityReturnRate,
    inflationRate: plan.inflationRate,
  }
}

interface LocalMetrics {
  fiNumber: number
  firePct: number
  raPct: number | null
  bridgePct: number | null
  covPct: number
  pvToday: number | null
  bridgeYears: number
  yearsToRetirement: number
  yearsInRetirement: number
  realReturnRate: number
  netMonthlyExpenses: number
  totalMonthlyIncome: number
}

function annuityPv(rate: number, periods: number): number {
  if (periods <= 0) return 0
  if (rate <= 0) return periods
  return (1 - Math.pow(1 + rate, -periods)) / rate
}

function computeLocal(s: Sliders): LocalMetrics {
  const yearsToRetirement = Math.max(1, s.retirementAge - s.currentAge)
  const yearsInRetirement = Math.max(0, s.lifeExpectancy - s.retirementAge)
  const pensionMonthly =
    s.pensionMonthly + s.socialSecurityMonthly + s.otherIncomeMonthly
  const totalMonthlyIncome = pensionMonthly
  const netMonthlyExpenses = Math.max(0, s.monthlyExpenses - totalMonthlyIncome)
  const fiNumber = netMonthlyExpenses * 12 * 25
  const firePct = fiNumber > 0 ? (s.liquidAssets / fiNumber) * 100 : 100
  const realReturnRate = s.equityReturnRate - s.inflationRate

  let raPct: number | null = null
  let pvToday: number | null = null
  if (
    yearsInRetirement > 0 &&
    fiNumber > 0 &&
    pensionMonthly > 0 &&
    realReturnRate > 0
  ) {
    const pvAtRetirement =
      pensionMonthly * 12 * annuityPv(realReturnRate, yearsInRetirement)
    pvToday = pvAtRetirement / Math.pow(1 + realReturnRate, yearsToRetirement)
    raPct = ((s.liquidAssets + pvToday) / fiNumber) * 100
  }

  let bridgePct: number | null = null
  const annualExp = s.monthlyExpenses * 12
  const bridgeYears = annualExp > 0 ? s.liquidAssets / annualExp : yearsToRetirement
  if (yearsToRetirement > 0 && pensionMonthly > 0) {
    bridgePct = Math.min((bridgeYears / yearsToRetirement) * 100, 100)
  }

  const covPct = s.monthlyExpenses > 0 ? (pensionMonthly / s.monthlyExpenses) * 100 : 100

  return {
    fiNumber,
    firePct,
    raPct,
    bridgePct,
    covPct,
    pvToday,
    bridgeYears,
    yearsToRetirement,
    yearsInRetirement,
    realReturnRate,
    netMonthlyExpenses,
    totalMonthlyIncome,
  }
}

const fmt = (n: number, digits = 0): string =>
  n.toLocaleString("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  })

const fmtPct = (n: number | null | undefined, digits = 1): string =>
  n == null ? "—" : `${n.toFixed(digits)}%`

const fmtMoney = (currency: string, n: number | null | undefined): string =>
  n == null ? "—" : `${currency} ${fmt(Math.round(n))}`

function colorFor(pct: number | null | undefined): string {
  if (pct == null) return "bg-gray-300"
  if (pct < 50) return "bg-red-500"
  if (pct < 80) return "bg-amber-500"
  return "bg-green-500"
}

function textColorFor(pct: number | null | undefined): string {
  if (pct == null) return "text-gray-400"
  if (pct < 50) return "text-red-600"
  if (pct < 80) return "text-amber-600"
  return "text-green-600"
}

function diffBadge(
  backend: number | null | undefined,
  local: number | null | undefined,
): React.ReactElement | null {
  if (backend == null || local == null) return null
  const diff = backend - local
  if (Math.abs(diff) < 0.5) {
    return (
      <span className="text-xs text-green-600 font-mono">
        Δ {diff >= 0 ? "+" : ""}
        {diff.toFixed(2)}pp ✓
      </span>
    )
  }
  return (
    <span className="text-xs text-amber-600 font-mono">
      Δ {diff >= 0 ? "+" : ""}
      {diff.toFixed(2)}pp
    </span>
  )
}

interface GaugeProps {
  title: string
  formula: string
  backendPct: number | null | undefined
  localPct: number | null | undefined
  metaParts: React.ReactNode
}

function Gauge({
  title,
  formula,
  backendPct,
  localPct,
  metaParts,
}: GaugeProps): React.ReactElement {
  const displayPct = backendPct ?? 0
  const clamped = Math.max(0, Math.min(100, displayPct))
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-3 shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <div>
          <div className="text-sm font-semibold text-gray-900">{title}</div>
          <div className="text-xs text-gray-500 font-mono">{formula}</div>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-mono font-semibold ${textColorFor(backendPct)}`}>
            {fmtPct(backendPct)}
          </div>
          <div className="text-xs text-gray-500 font-mono">
            local {fmtPct(localPct)}
          </div>
          {diffBadge(backendPct, localPct)}
        </div>
      </div>
      <div className="h-2 bg-gray-100 rounded overflow-hidden mb-2">
        <div
          className={`h-full transition-all ${colorFor(backendPct)}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <div className="text-xs text-gray-600">{metaParts}</div>
    </div>
  )
}

interface SliderFieldProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  format?: (n: number) => string
  onChange: (n: number) => void
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: SliderFieldProps): React.ReactElement {
  const display = format ? format(value) : fmt(value)
  return (
    <div className="mb-3">
      <label className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{label}</span>
        <span className="font-mono text-gray-900">{display}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-independence-600"
      />
    </div>
  )
}

function IndependenceDebug(): React.ReactElement {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)
  const [sliders, setSliders] = useState<Sliders | null>(null)
  const [projection, setProjection] = useState<RetirementProjection | null>(null)
  const [projError, setProjError] = useState<string | null>(null)
  const [projLoading, setProjLoading] = useState(false)

  const { data: plansData, isLoading: plansLoading } = useSwr<PlansResponse>(
    plansKey,
    simpleFetcher(plansKey),
  )

  const holdingKeyUrl = holdingKey("aggregated", "today")
  const { data: holdingsResponse, isLoading: holdingsLoading } = useSwr<{
    data: HoldingContract
  }>(holdingKeyUrl, simpleFetcher(holdingKeyUrl), {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60000,
  })

  const holdingsData = holdingsLoading ? undefined : holdingsResponse?.data
  const assets = useAssetBreakdown(holdingsData)

  const plans = useMemo(() => plansData?.data ?? [], [plansData])
  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === selectedPlanId) ?? null,
    [plans, selectedPlanId],
  )

  // Auto-select primary plan once data loads
  useEffect(() => {
    if (selectedPlanId || plans.length === 0) return
    const primary = plans.find((p) => p.isPrimary) ?? plans[0]
    setSelectedPlanId(primary.id)
  }, [plans, selectedPlanId])

  // Seed sliders when plan or assets change
  useEffect(() => {
    if (!selectedPlan || !assets.hasAssets) return
    setSliders(planToSliders(selectedPlan, assets.liquidAssets))
  }, [selectedPlan, assets.hasAssets, assets.liquidAssets])

  // Debounced backend recalculation.
  // AbortController per scheduled request prevents stale responses (slider drag
  // can fire request N+1 before N returns; without abort the older response can
  // land last and overwrite the fresh state).
  useEffect(() => {
    if (!selectedPlan || !sliders || !assets.hasAssets) return undefined
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setProjLoading(true)
      setProjError(null)
      try {
        const body = {
          currency: selectedPlan.expensesCurrency,
          liquidAssets: sliders.liquidAssets,
          nonSpendableAssets: assets.nonSpendableAssets,
          currentAge: sliders.currentAge,
          retirementAge: sliders.retirementAge,
          lifeExpectancy: sliders.lifeExpectancy,
          monthlyExpenses: sliders.monthlyExpenses,
          pensionMonthly: sliders.pensionMonthly,
          socialSecurityMonthly: sliders.socialSecurityMonthly,
          otherIncomeMonthly: sliders.otherIncomeMonthly,
          equityReturnRate: sliders.equityReturnRate,
          inflationRate: sliders.inflationRate,
        }
        const res = await fetch(
          `/api/independence/projection/${selectedPlan.id}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: controller.signal,
          },
        )
        if (!res.ok) {
          throw new Error(`Projection failed: ${res.status}`)
        }
        const result: ProjectionResponse = await res.json()
        if (!controller.signal.aborted) {
          setProjection(result.data)
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return
        if (!controller.signal.aborted) {
          setProjError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (!controller.signal.aborted) {
          setProjLoading(false)
        }
      }
    }, PROJECTION_DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [selectedPlan, sliders, assets.hasAssets, assets.nonSpendableAssets])

  const local = sliders ? computeLocal(sliders) : null
  const fiMetrics = projection?.fiMetrics
  const planInputs = projection?.planInputs
  const currency = selectedPlan?.expensesCurrency ?? "$"

  const updateSlider = (key: keyof Sliders) => (n: number) => {
    setSliders((prev) => (prev ? { ...prev, [key]: n } : prev))
  }

  return (
    <>
      <Head>
        <title>Independence Debug | Beancounter</title>
      </Head>

      <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Independence Metric Debug
              </h1>
              <p className="text-sm text-gray-600">
                Compare svc-retire FI metrics against local playground formulas.
                Sliders override projection inputs (local-only — nothing saved).
              </p>
            </div>
            <Link
              href="/independence"
              className="text-sm text-independence-600 hover:text-independence-800"
            >
              ← Plans
            </Link>
          </div>

          {(plansLoading || holdingsLoading) && (
            <Spinner label="Loading plans…" />
          )}

          {!plansLoading && plans.length === 0 && (
            <Alert>No plans found. Create one first.</Alert>
          )}

          {selectedPlan && sliders && (
            <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
              {/* Sliders */}
              <aside className="bg-white rounded-lg border border-gray-200 p-5">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Plan
                </label>
                <select
                  value={selectedPlanId ?? ""}
                  onChange={(e) => {
                    setSelectedPlanId(e.target.value)
                    setProjection(null)
                  }}
                  className="w-full mb-4 border border-gray-300 rounded px-2 py-1.5 text-sm"
                >
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.isPrimary ? " ★" : ""}
                    </option>
                  ))}
                </select>

                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 mt-4">
                  Person
                </h2>
                <SliderField
                  label="Current age"
                  value={sliders.currentAge}
                  min={25}
                  max={75}
                  step={1}
                  onChange={updateSlider("currentAge")}
                />
                <SliderField
                  label="Retirement age"
                  value={sliders.retirementAge}
                  min={Math.max(sliders.currentAge + 1, 40)}
                  max={80}
                  step={1}
                  onChange={updateSlider("retirementAge")}
                />
                <SliderField
                  label="Life expectancy"
                  value={sliders.lifeExpectancy}
                  min={Math.max(sliders.retirementAge + 1, 70)}
                  max={105}
                  step={1}
                  onChange={updateSlider("lifeExpectancy")}
                />

                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 mt-4">
                  Money ({currency})
                </h2>
                <SliderField
                  label="Liquid assets"
                  value={sliders.liquidAssets}
                  min={0}
                  max={Math.max(2_000_000, sliders.liquidAssets * 2)}
                  step={5000}
                  onChange={updateSlider("liquidAssets")}
                />
                <SliderField
                  label="Monthly expenses"
                  value={sliders.monthlyExpenses}
                  min={0}
                  max={20000}
                  step={100}
                  onChange={updateSlider("monthlyExpenses")}
                />
                <SliderField
                  label="Pension / mo"
                  value={sliders.pensionMonthly}
                  min={0}
                  max={10000}
                  step={50}
                  onChange={updateSlider("pensionMonthly")}
                />
                <SliderField
                  label="Social security / mo"
                  value={sliders.socialSecurityMonthly}
                  min={0}
                  max={10000}
                  step={50}
                  onChange={updateSlider("socialSecurityMonthly")}
                />
                <SliderField
                  label="Other income / mo"
                  value={sliders.otherIncomeMonthly}
                  min={0}
                  max={10000}
                  step={50}
                  onChange={updateSlider("otherIncomeMonthly")}
                />

                <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 mt-4">
                  Rates
                </h2>
                <SliderField
                  label="Equity return"
                  value={sliders.equityReturnRate}
                  min={0}
                  max={0.15}
                  step={0.001}
                  format={(n) => `${(n * 100).toFixed(2)}%`}
                  onChange={updateSlider("equityReturnRate")}
                />
                <SliderField
                  label="Inflation"
                  value={sliders.inflationRate}
                  min={0}
                  max={0.1}
                  step={0.001}
                  format={(n) => `${(n * 100).toFixed(2)}%`}
                  onChange={updateSlider("inflationRate")}
                />
              </aside>

              {/* Preview */}
              <main>
                {projError && (
                  <div className="mb-3">
                    <Alert>{projError}</Alert>
                  </div>
                )}

                <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 text-sm text-gray-700">
                  <div className="flex justify-between items-baseline mb-1">
                    <strong className="text-gray-900">{selectedPlan.name}</strong>
                    {projLoading && <Spinner label="Recalculating…" />}
                  </div>
                  Age <b>{sliders.currentAge}</b>, retire at{" "}
                  <b>{sliders.retirementAge}</b> (in{" "}
                  {local?.yearsToRetirement}y), live to{" "}
                  <b>{sliders.lifeExpectancy}</b>. Liquid{" "}
                  <b>{fmtMoney(currency, sliders.liquidAssets)}</b>. Expenses{" "}
                  <b>{fmtMoney(currency, sliders.monthlyExpenses)}/mo</b>.
                  Guaranteed income from {sliders.retirementAge}:{" "}
                  <b>
                    {fmtMoney(
                      currency,
                      sliders.pensionMonthly +
                        sliders.socialSecurityMonthly +
                        sliders.otherIncomeMonthly,
                    )}
                    /mo
                  </b>
                  . FI Number <b>{fmtMoney(currency, local?.fiNumber)}</b>.
                </div>

                <Gauge
                  title="Current — FI Progress"
                  formula="liquid / (25 × netAnnualExpenses)"
                  backendPct={fiMetrics?.fiProgress}
                  localPct={local?.firePct}
                  metaParts={
                    <>
                      Gap to FI:{" "}
                      <b>{fmtMoney(currency, fiMetrics?.gapToFi)}</b>. Locked
                      pension assets ignored.
                    </>
                  }
                />

                <Gauge
                  title="Option A — Retirement-Age FI"
                  formula="(liquid + PV(guaranteed income)) / fiNumber"
                  backendPct={fiMetrics?.retirementAgeFiProgress}
                  localPct={local?.raPct}
                  metaParts={
                    <>
                      PV today of pension income:{" "}
                      <b>
                        {fmtMoney(currency, fiMetrics?.pvGuaranteedIncomeToday)}
                      </b>{" "}
                      ({local?.yearsInRetirement}y of income starting in{" "}
                      {local?.yearsToRetirement}y). Local PV:{" "}
                      <b>{fmtMoney(currency, local?.pvToday)}</b>.
                    </>
                  }
                />

                <Gauge
                  title="Option B — Bridge Years"
                  formula="liquid / preRetirementExpenses, capped at yearsToPayout"
                  backendPct={fiMetrics?.bridgeProgress}
                  localPct={local?.bridgePct}
                  metaParts={
                    <>
                      Liquid covers{" "}
                      <b>
                        {fiMetrics?.bridgeYears != null
                          ? `${fiMetrics.bridgeYears.toFixed(1)}y`
                          : "—"}
                      </b>{" "}
                      of full expenses (backend). Local:{" "}
                      <b>{local?.bridgeYears.toFixed(1)}y</b>. Need{" "}
                      <b>
                        {fiMetrics?.bridgeYearsNeeded ??
                          local?.yearsToRetirement}
                        y
                      </b>{" "}
                      of bridge.
                    </>
                  }
                />

                <Gauge
                  title="Option C — Income Coverage"
                  formula="guaranteedMonthlyIncome / monthlyExpenses (at payout age)"
                  backendPct={fiMetrics?.incomeCoverageAtRetirement}
                  localPct={local?.covPct}
                  metaParts={
                    <>
                      <b>
                        {fmtMoney(
                          currency,
                          fiMetrics?.totalMonthlyIncome ??
                            local?.totalMonthlyIncome,
                        )}
                        /mo
                      </b>{" "}
                      guaranteed against{" "}
                      <b>{fmtMoney(currency, sliders.monthlyExpenses)}/mo</b>{" "}
                      expenses.
                    </>
                  }
                />

                <div className="bg-white rounded-lg border border-gray-200 p-4 mt-5">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Diagnostics
                  </h3>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs font-mono text-gray-700">
                    <div>
                      fiNumber (backend):{" "}
                      <b>{fmtMoney(currency, fiMetrics?.fiNumber)}</b>
                    </div>
                    <div>
                      fiNumber (local):{" "}
                      <b>{fmtMoney(currency, local?.fiNumber)}</b>
                    </div>
                    <div>
                      netMonthlyExpenses (backend):{" "}
                      <b>{fmtMoney(currency, fiMetrics?.netMonthlyExpenses)}</b>
                    </div>
                    <div>
                      netMonthlyExpenses (local):{" "}
                      <b>
                        {fmtMoney(currency, local?.netMonthlyExpenses)}
                      </b>
                    </div>
                    <div>
                      totalMonthlyIncome (backend):{" "}
                      <b>{fmtMoney(currency, fiMetrics?.totalMonthlyIncome)}</b>
                    </div>
                    <div>
                      totalMonthlyIncome (local, ex rental):{" "}
                      <b>{fmtMoney(currency, local?.totalMonthlyIncome)}</b>
                    </div>
                    <div>
                      blendedReturnRate (backend):{" "}
                      <b>
                        {planInputs
                          ? `${(planInputs.blendedReturnRate * 100).toFixed(2)}%`
                          : "—"}
                      </b>
                    </div>
                    <div>
                      realReturn (local = equity − inflation):{" "}
                      <b>
                        {local
                          ? `${(local.realReturnRate * 100).toFixed(2)}%`
                          : "—"}
                      </b>
                    </div>
                    <div>
                      yearsToRetirement: <b>{local?.yearsToRetirement}</b>
                    </div>
                    <div>
                      yearsInRetirement: <b>{local?.yearsInRetirement}</b>
                    </div>
                    <div>
                      rentalIncomeMonthly (backend):{" "}
                      <b>
                        {fmtMoney(currency, planInputs?.rentalIncomeMonthly)}
                      </b>
                    </div>
                    <div>
                      nonSpendableAssets:{" "}
                      <b>{fmtMoney(currency, assets.nonSpendableAssets)}</b>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-3">
                    Note: local compute treats pension+ss+other as guaranteed
                    income; backend may add derived pension income from policy
                    assets. Backend rental income is excluded from local pension
                    PV (it&apos;s continuous illiquid income, not pension-shaped).
                    Local realReturn uses equity slider only; backend blends
                    equity/cash/housing weighted by allocation.
                  </p>
                </div>
              </main>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default withPageAuthRequired(IndependenceDebug)
