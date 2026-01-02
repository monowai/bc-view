import React, { useState } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { GetServerSideProps } from "next"
import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
import Link from "next/link"
import { usePlan } from "@components/features/rebalance/hooks/usePlan"
import StatusBadge from "@components/features/rebalance/common/StatusBadge"
import PlanItemsTable from "@components/features/rebalance/plans/PlanItemsTable"
import ExecutionDialog from "@components/features/rebalance/execution/ExecutionDialog"
import { TableSkeletonLoader } from "@components/ui/SkeletonLoader"
import { FormatValue } from "@components/ui/MoneyUtils"

function PlanDetailPage(): React.ReactElement {
  const { t } = useTranslation("common")
  const router = useRouter()
  const { id } = router.query

  const { plan, isLoading, error, mutate } = usePlan(id as string)
  const [showExecutionDialog, setShowExecutionDialog] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  const handleRefresh = async (): Promise<void> => {
    setIsRefreshing(true)
    try {
      await fetch(`/api/rebalance/plans/${id}/refresh`, { method: "POST" })
      mutate()
    } catch (err) {
      console.error("Failed to refresh plan:", err)
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleCancel = async (): Promise<void> => {
    if (!window.confirm(t("rebalance.plans.cancelConfirm", "Cancel this plan?"))) {
      return
    }
    setIsCancelling(true)
    try {
      await fetch(`/api/rebalance/plans/${id}/cancel`, { method: "POST" })
      mutate()
    } catch (err) {
      console.error("Failed to cancel plan:", err)
    } finally {
      setIsCancelling(false)
    }
  }

  if (isLoading) {
    return (
      <div className="w-full py-4">
        <TableSkeletonLoader rows={5} />
      </div>
    )
  }

  if (error || !plan) {
    return (
      <div className="w-full py-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {t("rebalance.plans.error", "Failed to load plan")}
        </div>
      </div>
    )
  }

  const canExecute =
    plan.status === "READY" &&
    plan.items.some((item) => !item.locked && !item.excluded && item.action !== "HOLD")
  const canRefresh = plan.status !== "COMPLETED" && plan.status !== "CANCELLED"
  const canCancel = plan.status !== "COMPLETED" && plan.status !== "CANCELLED"

  return (
    <div className="w-full py-4">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-4">
        <Link href="/rebalance" className="hover:text-blue-600">
          {t("rebalance.title", "Rebalancing")}
        </Link>
        <span className="mx-2">/</span>
        <span className="text-gray-900">{plan.name}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{plan.name}</h1>
            <StatusBadge status={plan.status} i18nPrefix="rebalance.plans.status" />
          </div>
          <p className="text-sm text-gray-600 mt-1">
            {t("rebalance.plans.model", "Model")}: {plan.modelPortfolioName}
          </p>
        </div>
        <div className="flex gap-2">
          {canRefresh && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors flex items-center disabled:bg-gray-400"
            >
              <i className={`fas fa-sync-alt mr-2 ${isRefreshing ? "fa-spin" : ""}`}></i>
              {t("rebalance.plans.refresh", "Refresh")}
            </button>
          )}
          {canCancel && (
            <button
              onClick={handleCancel}
              disabled={isCancelling}
              className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition-colors flex items-center disabled:bg-red-400"
            >
              <i className="fas fa-times mr-2"></i>
              {t("rebalance.plans.cancel", "Cancel")}
            </button>
          )}
          {canExecute && (
            <button
              onClick={() => setShowExecutionDialog(true)}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors flex items-center"
            >
              <i className="fas fa-play mr-2"></i>
              {t("rebalance.plans.execute", "Execute")}
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500">
            {t("rebalance.plans.currentValue", "Current Value")}
          </div>
          <div className="text-xl font-bold">
            <FormatValue value={plan.totalCurrentValue} />
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500">
            {t("rebalance.plans.targetValue", "Target Value")}
          </div>
          <div className="text-xl font-bold">
            <FormatValue value={plan.totalTargetValue} />
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500">
            {t("rebalance.plans.cashDelta", "Cash Delta")}
          </div>
          <div className={`text-xl font-bold ${plan.cashDelta > 0 ? "text-green-600" : plan.cashDelta < 0 ? "text-red-600" : ""}`}>
            {plan.cashDelta > 0 ? "+" : ""}
            <FormatValue value={plan.cashDelta} />
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm text-gray-500">
            {t("rebalance.plans.scenario", "Scenario")}
          </div>
          <div className="text-xl font-bold">
            {plan.scenario === "INVEST_CASH"
              ? t("rebalance.scenario.investCash", "Invest Cash")
              : t("rebalance.scenario.rebalance", "Rebalance")}
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-3">
          {t("rebalance.items.title", "Plan Items")}
        </h2>
        <PlanItemsTable
          items={plan.items}
          currencySymbol={plan.planCurrency}
        />
      </div>

      {/* Execution Dialog */}
      {showExecutionDialog && (
        <ExecutionDialog
          modalOpen={showExecutionDialog}
          onClose={() => setShowExecutionDialog(false)}
          plan={plan}
          onSuccess={() => {
            setShowExecutionDialog(false)
            mutate()
          }}
        />
      )}
    </div>
  )
}

export default withPageAuthRequired(PlanDetailPage)

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
