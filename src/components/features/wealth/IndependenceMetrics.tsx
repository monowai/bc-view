import React, { useState } from "react"
import Link from "next/link"
import useSwr from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"
import Dialog from "@components/ui/Dialog"
import { Currency, Transaction } from "types/beancounter"
import type {
  CompositeProjectionResult,
  IndependencePlan,
  RetirementPlan,
  RetirementProjection,
} from "types/independence"
import WealthSection from "@components/features/wealth/WealthSection"
import Spinner from "@components/ui/Spinner"
import { ACTIVE_PLAN_QUERY_PARAM } from "@hooks/useIndependencePlans"
import { investmentsMonthlyTransactionsKey } from "@utils/api/client/trns"
import { isJourneyRetired, isRetired } from "@lib/independence/retiredMetrics"
import {
  type RetiredBasis,
  journeyRetiredBasis,
  phaseRetiredBasis,
} from "@lib/independence/retiredBasis"
import { useIndependenceSettings } from "@components/features/independence/useIndependenceSettings"
import {
  type WorkingBasis,
  journeyWorkingBasis,
  phaseWorkingBasis,
} from "@lib/independence/workingBasis"
import RetiredMetrics from "@components/features/wealth/RetiredMetrics"
import WorkingMetrics from "@components/features/wealth/WorkingMetrics"
import { useRetiredMetricsData } from "@components/features/wealth/useRetiredMetricsData"
import SpendLogDialog from "@components/features/wealth/SpendLogDialog"

interface MonthlyInvestmentData {
  startDate: string
  endDate: string
  totalInvested: number
  currency?: string
}

interface IndependenceMetricsProps {
  primaryPlan: RetirementPlan
  projectionData: RetirementProjection | null
  projectionLoading: boolean
  /** The user's primary journey; absent on an account that has none. */
  journey?: IndependencePlan
  /** The journey's projection; null while loading, on failure, or with no journey. */
  journeyProjection?: CompositeProjectionResult | null
  journeyProjectionLoading?: boolean
  /** The journey's projection could not be had; the phase stands in for it. */
  journeyProjectionFailed?: boolean
  monthlyInvestmentData: MonthlyInvestmentData | undefined
  displayCurrency: Currency | null
  collapsed: boolean
  onToggle: () => void
}

/** Drawdown cards, fed by the data only a retired owner needs. */
function RetiredMetricsSection({
  basis,
  displayCurrency,
}: {
  basis: RetiredBasis
  displayCurrency: Currency | null
}): React.ReactElement {
  const cardData = useRetiredMetricsData(basis)
  const [showSpend, setShowSpend] = useState(false)
  const currencySymbol =
    displayCurrency?.code === basis.currency
      ? displayCurrency.symbol
      : `${basis.currency} `
  return (
    <>
      <RetiredMetrics
        basis={basis}
        currencySymbol={currencySymbol}
        onLogSpend={() => setShowSpend(true)}
        {...cardData}
      />
      {showSpend && <SpendLogDialog onClose={() => setShowSpend(false)} />}
    </>
  )
}

/**
 * The retired cards for the journey. The horizon is the user's own life
 * expectancy: a journey spans phases, and no one phase speaks for it.
 */
function JourneyRetiredSection({
  journey,
  projection,
  displayCurrency,
}: {
  journey: IndependencePlan
  projection: CompositeProjectionResult
  displayCurrency: Currency | null
}): React.ReactElement {
  const { settings } = useIndependenceSettings()
  return (
    <RetiredMetricsSection
      basis={journeyRetiredBasis(journey, projection, settings?.lifeExpectancy)}
      displayCurrency={displayCurrency}
    />
  )
}

/** What the section shows: one journey or phase, retired or still working. */
type MetricsView =
  | {
      kind: "journeyRetired"
      journey: IndependencePlan
      projection: CompositeProjectionResult
    }
  | { kind: "phaseRetired"; projection: RetirementProjection }
  | { kind: "working"; basis: WorkingBasis | null }

export default function IndependenceMetrics({
  primaryPlan,
  projectionData: phaseProjection,
  projectionLoading: phaseProjectionLoading,
  journey,
  journeyProjection = null,
  journeyProjectionLoading = false,
  journeyProjectionFailed = false,
  monthlyInvestmentData,
  displayCurrency,
  collapsed,
  onToggle,
}: IndependenceMetricsProps): React.ReactElement {
  const [showInvestmentModal, setShowInvestmentModal] = useState(false)

  // The journey speaks for the owner; the phase only when there is no journey
  // projection to ask. Until the journey answers, hold the loading state
  // rather than show the phase's figures and then swap them.
  const projectionLoading = phaseProjectionLoading || journeyProjectionLoading
  const view = ((): MetricsView => {
    if (journeyProjectionLoading) return { kind: "working", basis: null }
    if (journey && journeyProjection) {
      return isJourneyRetired(journeyProjection)
        ? { kind: "journeyRetired", journey, projection: journeyProjection }
        : { kind: "working", basis: journeyWorkingBasis(journeyProjection) }
    }
    if (phaseProjection && isRetired(phaseProjection)) {
      return { kind: "phaseRetired", projection: phaseProjection }
    }
    return {
      kind: "working",
      basis: phaseWorkingBasis(phaseProjection, primaryPlan),
    }
  })()

  // Fetch transactions only when modal is open
  const investmentTrnsUrl = showInvestmentModal
    ? investmentsMonthlyTransactionsKey
    : null
  const { data: investmentTrnsData } = useSwr<{ data: Transaction[] }>(
    investmentTrnsUrl,
    investmentTrnsUrl ? simpleFetcher(investmentTrnsUrl) : null,
  )

  const metrics = ((): React.ReactElement => {
    if (view.kind === "journeyRetired") {
      return (
        <JourneyRetiredSection
          journey={view.journey}
          projection={view.projection}
          displayCurrency={displayCurrency}
        />
      )
    }
    if (view.kind === "phaseRetired") {
      return (
        <RetiredMetricsSection
          basis={phaseRetiredBasis(view.projection)}
          displayCurrency={displayCurrency}
        />
      )
    }
    return (
      <WorkingMetrics
        basis={view.basis}
        loading={projectionLoading}
        invested={monthlyInvestmentData?.totalInvested}
        displayCurrency={displayCurrency}
        onShowInvestments={() => setShowInvestmentModal(true)}
      />
    )
  })()

  return (
    <>
      <WealthSection
        title="Independence Metrics"
        icon="fa-chart-line"
        collapsed={collapsed}
        onToggle={onToggle}
        note={projectionLoading && <Spinner label="Calculating..." />}
        action={
          <Link
            href={
              journey
                ? `/independence?${ACTIVE_PLAN_QUERY_PARAM}=${encodeURIComponent(journey.id)}`
                : `/independence/plans/${primaryPlan.id}`
            }
            className="shrink-0 rounded-sm text-sm text-wealth-600 hover:text-wealth-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-wealth-500"
          >
            Projections →
          </Link>
        }
      >
        {journeyProjectionFailed && (
          <p className="text-xs text-gray-500 mb-3">
            Journey projection unavailable — figures are for the current phase
            only
          </p>
        )}
        {metrics}
      </WealthSection>

      {/* Monthly Investment Transactions Modal */}
      {showInvestmentModal && (
        <Dialog
          title={
            <div>
              <div>Monthly Investment Transactions</div>
              <p className="text-sm font-normal text-gray-500 mt-0.5">
                {monthlyInvestmentData?.startDate &&
                monthlyInvestmentData?.endDate
                  ? `${monthlyInvestmentData.startDate} – ${monthlyInvestmentData.endDate}`
                  : "Last 30 days"}
              </p>
            </div>
          }
          onClose={() => setShowInvestmentModal(false)}
          maxWidth="2xl"
          scrollable
          footer={
            <p className="text-xs text-gray-500 w-full">
              Shows BUY and SELL transactions only. ADD/transfers are excluded.
            </p>
          }
        >
          {!investmentTrnsData ? (
            <div className="flex justify-center py-8">
              <Spinner size="lg" />
            </div>
          ) : investmentTrnsData.data.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              No investment transactions in the last 30 days
            </p>
          ) : (
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Date
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Type
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Asset
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {investmentTrnsData.data.map((trn) => (
                  <tr key={trn.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm text-gray-600">
                      {trn.tradeDate}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                          trn.trnType === "BUY"
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {trn.trnType}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-900">
                      {trn.asset?.code || trn.asset?.name || "Unknown"}
                    </td>
                    <td
                      className={`px-3 py-2 text-sm text-right font-medium ${
                        trn.trnType === "BUY"
                          ? "text-green-700"
                          : "text-red-600"
                      }`}
                    >
                      {trn.trnType === "SELL" ? "-" : ""}
                      {trn.tradeCurrency?.symbol}
                      {Math.abs(trn.tradeAmount).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr>
                  <td
                    colSpan={3}
                    className="px-3 py-2 text-sm font-semibold text-gray-900"
                  >
                    Net Total ({displayCurrency?.code})
                  </td>
                  <td
                    className={`px-3 py-2 text-sm text-right font-bold ${
                      (monthlyInvestmentData?.totalInvested ?? 0) >= 0
                        ? "text-green-700"
                        : "text-red-600"
                    }`}
                  >
                    {(monthlyInvestmentData?.totalInvested ?? 0) < 0 ? "-" : ""}
                    {displayCurrency?.symbol}
                    {Math.abs(
                      monthlyInvestmentData?.totalInvested ?? 0,
                    ).toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </Dialog>
      )}
    </>
  )
}
