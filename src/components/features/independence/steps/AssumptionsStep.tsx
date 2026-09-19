import React, { useEffect, useMemo, useRef, useState, useCallback } from "react"
import {
  Control,
  Controller,
  FieldErrors,
  useWatch,
  UseFormSetValue,
} from "react-hook-form"
import Link from "next/link"
import { IndependencePlan, WizardFormData } from "types/independence"
import { AllocationResponse } from "types/beancounter"
import { wizardMessages } from "@lib/independence/messages"
import { normalizeAllocation } from "@lib/independence/planHelpers"
import { toPercent } from "@lib/independence/conversions"
import Spinner from "@components/ui/Spinner"
import MathInput from "@components/ui/MathInput"
import { INPUT_CLS_BASE } from "@lib/ui/formClasses"

const msg = wizardMessages.steps.assumptions
const fields = wizardMessages.fields

/** Copy for a journey rate the journey has never stated. */
const UNSET_RATE = "Not set — this stage's own value applies"

/**
 * One inherited rate, read back rather than edited. Journey rates are decimal
 * fractions; an absent one means the journey never stated it, and svc-retire
 * falls back to this stage's own column for that rate alone — which is what
 * makes a stage MIXED rather than fully inherited.
 */
function InheritedRate({
  label,
  rate,
}: {
  label: string
  rate: number | undefined
}): React.ReactElement {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-sm text-gray-700">{label}</span>
      {rate === undefined ? (
        <span className="text-right text-xs text-gray-500">{UNSET_RATE}</span>
      ) : (
        <span className="font-mono text-sm tabular-nums text-gray-900">
          {toPercent(rate, 0)}%
        </span>
      )}
    </div>
  )
}

interface AssumptionsStepProps {
  control: Control<WizardFormData>
  errors: FieldErrors<WizardFormData>
  setValue: UseFormSetValue<WizardFormData>
  isEditMode?: boolean
  /**
   * Portfolios this stage's journey draws on, used to seed the allocation from
   * what the user actually holds.
   *
   * Previously read off a `selectedPortfolioIds` form field that the wizard's
   * Wealth step wrote. That step is gone — wealth is defined by the journey,
   * not the stage — so the ids now arrive from the journey. Empty means the
   * seeding is skipped and the user sets the split by hand, which is what
   * happened anyway for a journey that excludes everything.
   */
  portfolioIds?: string[]
  /**
   * The journey this stage belongs to, when it has one. Its rates are what the
   * engine runs on unless this stage overrides them, so they are shown here
   * read-only rather than copied into the stage's own fields.
   *
   * Undefined while the journeys request is in flight, and for a stage with no
   * journey at all — both cases fall back to editing the stage's own rates,
   * which is all there is to edit.
   */
  journey?: IndependencePlan
}

export default function AssumptionsStep({
  control,
  errors,
  setValue,
  isEditMode,
  portfolioIds,
  journey,
}: AssumptionsStepProps): React.ReactElement {
  const hasAppliedAllocation = useRef(false)
  const [isLoadingAllocation, setIsLoadingAllocation] = useState(false)

  const selectedPortfolioIds = useMemo(() => portfolioIds ?? [], [portfolioIds])

  // Watch current allocation values to determine if they're already set
  const currentCashAllocation =
    useWatch({ control, name: "cashAllocation" }) ?? 0
  const currentEquityAllocation =
    useWatch({ control, name: "equityAllocation" }) ?? 0
  const currentHousingAllocation =
    useWatch({ control, name: "housingAllocation" }) ?? 0

  // Only auto-apply actual allocation if all values are 0 (not set)
  // This preserves user-saved allocations when editing a plan
  const hasExistingAllocation =
    currentCashAllocation > 0 ||
    currentEquityAllocation > 0 ||
    currentHousingAllocation > 0

  // Fetch and apply allocation data when portfolios are first selected
  // but ONLY if allocations are not already set (all are 0)
  useEffect(() => {
    if (
      selectedPortfolioIds.length === 0 ||
      hasAppliedAllocation.current ||
      hasExistingAllocation
    )
      return

    setIsLoadingAllocation(true)
    const ids = selectedPortfolioIds.join(",")

    fetch(`/api/holdings/allocation?asAt=today&ids=${encodeURIComponent(ids)}`)
      .then((res) => res.json())
      .then((response: AllocationResponse) => {
        if (response.data) {
          const { cashAllocation, equityAllocation, housingAllocation } =
            response.data
          const total = cashAllocation + equityAllocation + housingAllocation
          if (total > 0) {
            const norm = normalizeAllocation(
              equityAllocation,
              cashAllocation,
              housingAllocation,
            )
            setValue("cashAllocation", norm.cash)
            setValue("equityAllocation", norm.equity)
            setValue("housingAllocation", norm.housing)
            hasAppliedAllocation.current = true
          }
        }
      })
      .catch(console.error)
      .finally(() => setIsLoadingAllocation(false))
  }, [selectedPortfolioIds, setValue, hasExistingAllocation])

  // Function to refresh allocation from selected portfolios
  const refreshAllocation = useCallback((): void => {
    if (selectedPortfolioIds.length === 0) return

    setIsLoadingAllocation(true)
    const ids = selectedPortfolioIds.join(",")

    fetch(`/api/holdings/allocation?asAt=today&ids=${encodeURIComponent(ids)}`)
      .then((res) => res.json())
      .then((response: AllocationResponse) => {
        if (response.data) {
          const { cashAllocation, equityAllocation, housingAllocation } =
            response.data
          const total = cashAllocation + equityAllocation + housingAllocation
          if (total > 0) {
            const norm = normalizeAllocation(
              equityAllocation,
              cashAllocation,
              housingAllocation,
            )
            setValue("cashAllocation", norm.cash)
            setValue("equityAllocation", norm.equity)
            setValue("housingAllocation", norm.housing)
          }
        }
      })
      .catch(console.error)
      .finally(() => setIsLoadingAllocation(false))
  }, [selectedPortfolioIds, setValue])

  // Watch allocation and return values to calculate blended return
  // Use nullish coalescing (??) instead of || to allow 0 as a valid value
  const cashAllocation = useWatch({ control, name: "cashAllocation" }) ?? 20
  const equityAllocation = useWatch({ control, name: "equityAllocation" }) ?? 60
  const housingAllocation =
    useWatch({ control, name: "housingAllocation" }) ?? 20
  const cashReturnRate = useWatch({ control, name: "cashReturnRate" }) ?? 3.5
  const equityReturnRate = useWatch({ control, name: "equityReturnRate" }) ?? 7
  const housingReturnRate =
    useWatch({ control, name: "housingReturnRate" }) ?? 4

  const totalAllocation = cashAllocation + equityAllocation + housingAllocation

  const assumptionsInherited =
    useWatch({ control, name: "assumptionsInherited" }) ?? true
  // Only a stage with a journey can inherit. Without one there is nothing to
  // inherit from, which is also how svc-retire resolves it.
  const isInheriting = Boolean(journey) && assumptionsInherited

  /**
   * The rates this stage is actually projected with: the journey's while it
   * inherits, falling back per-rate to the stage's own where the journey has
   * never stated one — the same resolution svc-retire applies. Read rather
   * than re-derived, so the blended figure below describes the projection the
   * reader will see instead of a stale local copy.
   */
  const effectiveRate = (
    journeyRate: number | undefined,
    stageRate: number,
  ): number =>
    isInheriting && journeyRate !== undefined
      ? toPercent(journeyRate, 0)
      : stageRate

  const effectiveCashReturn = effectiveRate(
    journey?.cashReturnRate,
    cashReturnRate,
  )
  const effectiveEquityReturn = effectiveRate(
    journey?.equityReturnRate,
    equityReturnRate,
  )
  const effectiveHousingReturn = effectiveRate(
    journey?.housingReturnRate,
    housingReturnRate,
  )
  const blendedReturn = useMemo(() => {
    return (
      (cashAllocation / 100) * effectiveCashReturn +
      (equityAllocation / 100) * effectiveEquityReturn +
      (housingAllocation / 100) * effectiveHousingReturn
    ).toFixed(2)
  }, [
    cashAllocation,
    equityAllocation,
    housingAllocation,
    effectiveCashReturn,
    effectiveEquityReturn,
    effectiveHousingReturn,
  ])

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    allocation: false,
    returns: false,
    legacy: false,
  })

  const toggleSection = (section: string): void => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">
          {msg.title}
        </h2>
        <p className="text-sm text-gray-600">{msg.description}</p>
      </div>

      {!isEditMode && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start">
          <i className="fas fa-check-circle text-green-600 mt-0.5 mr-2"></i>
          <div>
            <p className="font-medium text-green-800">
              Defaults are ready to go
            </p>
            <p className="text-sm text-green-700 mt-0.5">{msg.defaultsNote}</p>
          </div>
        </div>
      )}

      {/* Asset Allocation Accordion */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection("allocation")}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center">
            <i className="fas fa-chart-pie text-independence-600 mr-3"></i>
            <div className="text-left">
              <h3 className="text-lg font-medium text-gray-800">
                {msg.assetAllocation}
              </h3>
              {!openSections.allocation && (
                <p className="text-sm text-gray-500">
                  Equity {equityAllocation}%, Cash {cashAllocation}%, Housing{" "}
                  {housingAllocation}% — {blendedReturn}% blended return
                </p>
              )}
            </div>
          </div>
          <i
            className={`fas fa-chevron-down text-gray-400 transition-transform ${openSections.allocation ? "rotate-180" : ""}`}
          ></i>
        </button>

        {openSections.allocation && (
          <div className="px-4 py-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                {msg.assetAllocationDescription}
              </p>
              {selectedPortfolioIds.length > 0 && (
                <button
                  type="button"
                  onClick={refreshAllocation}
                  disabled={isLoadingAllocation}
                  className="flex items-center px-3 py-1.5 text-sm bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50 ml-4 shrink-0"
                >
                  {isLoadingAllocation ? (
                    <>
                      <Spinner className="mr-2" />
                      {msg.loading}
                    </>
                  ) : (
                    <>
                      <i className="fas fa-sync-alt mr-2"></i>
                      {msg.useActual}
                    </>
                  )}
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label
                  htmlFor="equityAllocation"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {fields.equityAllocation}
                </label>
                <Controller
                  name="equityAllocation"
                  control={control}
                  render={({ field }) => (
                    <MathInput
                      id="equityAllocation"
                      value={field.value ?? 0}
                      onChange={field.onChange}
                      min={0}
                      max={100}
                      step={5}
                      className={`${INPUT_CLS_BASE} ${errors.equityAllocation ? "border-red-500" : "border-gray-300"}`}
                    />
                  )}
                />
                {errors.equityAllocation && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.equityAllocation.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="cashAllocation"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {fields.cashAllocation}
                </label>
                <Controller
                  name="cashAllocation"
                  control={control}
                  render={({ field }) => (
                    <MathInput
                      id="cashAllocation"
                      value={field.value ?? 0}
                      onChange={field.onChange}
                      min={0}
                      max={100}
                      step={5}
                      className={`${INPUT_CLS_BASE} ${errors.cashAllocation ? "border-red-500" : "border-gray-300"}`}
                    />
                  )}
                />
                {errors.cashAllocation && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.cashAllocation.message}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="housingAllocation"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  {fields.housingAllocation}
                </label>
                <Controller
                  name="housingAllocation"
                  control={control}
                  render={({ field }) => (
                    <MathInput
                      id="housingAllocation"
                      value={field.value ?? 0}
                      onChange={field.onChange}
                      min={0}
                      max={100}
                      step={5}
                      className={`${INPUT_CLS_BASE} ${errors.housingAllocation ? "border-red-500" : "border-gray-300"}`}
                    />
                  )}
                />
                {errors.housingAllocation ? (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.housingAllocation.message}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-gray-500">
                    Weights housing in the blended return calculation. Your
                    actual property balance comes from your portfolio valuation.
                  </p>
                )}
              </div>
            </div>

            <div
              className={`rounded-lg p-4 ${totalAllocation === 100 ? "bg-green-50 border border-green-200" : "bg-yellow-50 border border-yellow-200"}`}
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <i
                    className={`fas ${totalAllocation === 100 ? "fa-check-circle text-green-600" : "fa-exclamation-triangle text-yellow-600"} mr-3`}
                  ></i>
                  <div>
                    <span
                      className={`font-medium ${totalAllocation === 100 ? "text-green-800" : "text-yellow-800"}`}
                    >
                      {msg.totalAllocation}: {totalAllocation}%
                    </span>
                    {totalAllocation !== 100 && (
                      <p className="text-sm text-yellow-700">
                        {msg.allocationWarning}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm text-gray-600">
                    {msg.blendedReturn}
                  </span>
                  <p className="text-xl font-bold text-gray-900">
                    {blendedReturn}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Return Assumptions Accordion */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection("returns")}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center">
            <i className="fas fa-percentage text-independence-600 mr-3"></i>
            <div className="text-left">
              <h3 className="text-lg font-medium text-gray-800">
                {msg.returnAssumptions}
              </h3>
              {!openSections.returns && (
                <p className="text-sm text-gray-500">
                  Equity {effectiveEquityReturn}%, Cash {effectiveCashReturn}%,
                  Housing {effectiveHousingReturn}%
                  {isInheriting ? " — from your journey" : ""}
                </p>
              )}
            </div>
          </div>
          <i
            className={`fas fa-chevron-down text-gray-400 transition-transform ${openSections.returns ? "rotate-180" : ""}`}
          ></i>
        </button>

        {openSections.returns && (
          <div className="px-4 py-4 space-y-4">
            <p className="text-sm text-gray-600">
              {isInheriting
                ? "Your journey states these once, and every stage inherits them unless it overrides."
                : msg.returnAssumptionsDescription}
            </p>

            {journey && (
              <div className="flex items-start justify-between gap-4 rounded-lg bg-gray-50 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    Override for this stage
                  </p>
                  <p className="mt-0.5 text-xs text-gray-600">
                    Off, this stage uses your journey&apos;s assumptions. On, it
                    runs on its own — only this stage changes.
                  </p>
                </div>
                <Controller
                  name="assumptionsInherited"
                  control={control}
                  render={({ field }) => (
                    // A <button role="switch">, not an input wrapped in a
                    // label: that pairing double-fires in this codebase.
                    <button
                      type="button"
                      role="switch"
                      aria-label="Override for this stage"
                      aria-checked={!field.value}
                      onClick={() => field.onChange(!(field.value ?? true))}
                      className={`${
                        field.value ? "bg-gray-200" : "bg-independence-600"
                      } relative mt-0.5 inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-independence-500 focus:ring-offset-2 motion-reduce:transition-none`}
                    >
                      <span
                        className={`${
                          field.value ? "translate-x-0" : "translate-x-5"
                        } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out motion-reduce:transition-none`}
                      />
                    </button>
                  )}
                />
              </div>
            )}

            {isInheriting && journey && (
              <div>
                <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 px-3 py-1">
                  <InheritedRate
                    label="Equity return"
                    rate={journey.equityReturnRate}
                  />
                  <InheritedRate
                    label="Cash return"
                    rate={journey.cashReturnRate}
                  />
                  <InheritedRate
                    label="Housing return"
                    rate={journey.housingReturnRate}
                  />
                  <InheritedRate
                    label="Inflation"
                    rate={journey.inflationRate}
                  />
                  <InheritedRate label="Fees" rate={journey.feeRate} />
                  <InheritedRate
                    label="Investment tax"
                    rate={journey.investmentTaxRate}
                  />
                </div>
                <p className="mt-2 text-sm text-gray-600">
                  These come from your journey.{" "}
                  <Link
                    href={`/independence?view=assumptions&plan=${journey.id}`}
                    className="font-medium text-independence-700 underline-offset-2 hover:underline"
                  >
                    Edit in journey settings
                  </Link>
                </p>
              </div>
            )}

            {!isInheriting && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="equityReturnRate"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    {fields.equityReturnRate}
                  </label>
                  <Controller
                    name="equityReturnRate"
                    control={control}
                    render={({ field }) => (
                      <MathInput
                        id="equityReturnRate"
                        value={field.value ?? 0}
                        onChange={field.onChange}
                        min={0}
                        max={30}
                        step={0.5}
                        className={`${INPUT_CLS_BASE} ${errors.equityReturnRate ? "border-red-500" : "border-gray-300"}`}
                      />
                    )}
                  />
                  {errors.equityReturnRate && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.equityReturnRate.message}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="cashReturnRate"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    {fields.cashReturnRate}
                  </label>
                  <Controller
                    name="cashReturnRate"
                    control={control}
                    render={({ field }) => (
                      <MathInput
                        id="cashReturnRate"
                        value={field.value ?? 0}
                        onChange={field.onChange}
                        min={0}
                        max={20}
                        step={0.5}
                        className={`${INPUT_CLS_BASE} ${errors.cashReturnRate ? "border-red-500" : "border-gray-300"}`}
                      />
                    )}
                  />
                  {errors.cashReturnRate && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.cashReturnRate.message}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="housingReturnRate"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    {fields.housingReturnRate}
                  </label>
                  <Controller
                    name="housingReturnRate"
                    control={control}
                    render={({ field }) => (
                      <MathInput
                        id="housingReturnRate"
                        value={field.value ?? 0}
                        onChange={field.onChange}
                        min={0}
                        max={20}
                        step={0.5}
                        className={`${INPUT_CLS_BASE} ${errors.housingReturnRate ? "border-red-500" : "border-gray-300"}`}
                      />
                    )}
                  />
                  {errors.housingReturnRate ? (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.housingReturnRate.message}
                    </p>
                  ) : (
                    <p className="mt-1 text-xs text-gray-500">
                      Annual capital appreciation applied to your property
                      balance — runs independently from your liquid portfolio
                      return.
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="inflationRate"
                    className="block text-sm font-medium text-gray-700 mb-1"
                  >
                    {fields.inflationRate}
                  </label>
                  <Controller
                    name="inflationRate"
                    control={control}
                    render={({ field }) => (
                      <MathInput
                        id="inflationRate"
                        value={field.value ?? 0}
                        onChange={field.onChange}
                        min={0}
                        max={10}
                        step={0.5}
                        className={`${INPUT_CLS_BASE} ${errors.inflationRate ? "border-red-500" : "border-gray-300"}`}
                      />
                    )}
                  />
                  {errors.inflationRate && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.inflationRate.message}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legacy / Buffer Accordion */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection("legacy")}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center">
            <i className="fas fa-gift text-independence-600 mr-3"></i>
            <div className="text-left">
              <h3 className="text-lg font-medium text-gray-800">
                {msg.targetBalance}
              </h3>
              {!openSections.legacy && (
                <p className="text-sm text-gray-500">
                  {msg.targetBalancePlaceholder}
                </p>
              )}
            </div>
          </div>
          <i
            className={`fas fa-chevron-down text-gray-400 transition-transform ${openSections.legacy ? "rotate-180" : ""}`}
          ></i>
        </button>

        {openSections.legacy && (
          <div className="px-4 py-4 space-y-4">
            <p className="text-sm text-gray-600">
              {msg.targetBalanceDescription}
            </p>

            <div>
              <label
                htmlFor="targetBalance"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Target Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-gray-500">$</span>
                <Controller
                  name="targetBalance"
                  control={control}
                  render={({ field }) => (
                    <MathInput
                      id="targetBalance"
                      value={field.value ?? 0}
                      onChange={(v) => field.onChange(v || undefined)}
                      min={0}
                      step={10000}
                      placeholder={msg.targetBalancePlaceholder}
                      className={`w-full pl-8 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500 ${errors.targetBalance ? "border-red-500" : "border-gray-300"}`}
                    />
                  )}
                />
              </div>
              {errors.targetBalance && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.targetBalance.message}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
