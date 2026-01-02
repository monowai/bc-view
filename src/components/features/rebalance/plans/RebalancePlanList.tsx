import React from "react"
import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
import { usePlans } from "../hooks/usePlans"
import { TableSkeletonLoader } from "@components/ui/SkeletonLoader"
import StatusBadge from "../common/StatusBadge"
import { FormatValue } from "@components/ui/MoneyUtils"
import { formatDate } from "@utils/formatters"

const RebalancePlanList: React.FC = () => {
  const { t } = useTranslation("common")
  const router = useRouter()
  const { plans, isLoading, error } = usePlans()

  if (isLoading) {
    return <TableSkeletonLoader rows={3} />
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {t("rebalance.plans.error", "Failed to load rebalance plans")}
      </div>
    )
  }

  if (plans.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <i className="fas fa-balance-scale text-4xl text-gray-400 mb-4"></i>
        <p className="text-gray-600 mb-4">
          {t("rebalance.plans.empty", "No rebalance plans yet")}
        </p>
        <button
          onClick={() => router.push("/rebalance/wizard")}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
        >
          {t("rebalance.plans.create", "Create Plan")}
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
      <table className="min-w-full">
        <thead className="bg-gray-100">
          <tr className="border-b border-gray-200">
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
              {t("rebalance.plans.name", "Plan Name")}
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 hidden sm:table-cell">
              {t("rebalance.plans.model", "Model")}
            </th>
            <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
              {t("rebalance.plans.portfolios", "Portfolios")}
            </th>
            <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 hidden md:table-cell">
              {t("rebalance.plans.currentValue", "Current")}
            </th>
            <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 hidden md:table-cell">
              {t("rebalance.plans.targetValue", "Target")}
            </th>
            <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
              {t("rebalance.plans.status", "Status")}
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 hidden lg:table-cell">
              {t("rebalance.plans.created", "Created")}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {plans.map((plan) => (
            <tr
              key={plan.id}
              onClick={() => router.push(`/rebalance/plans/${plan.id}`)}
              className="hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <td className="px-4 py-3">
                <span className="font-medium text-blue-600">{plan.name}</span>
              </td>
              <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                {plan.modelPortfolioName}
              </td>
              <td className="px-4 py-3 text-center">
                <span className="bg-gray-100 px-2 py-1 rounded text-sm">
                  {plan.portfolioCount}
                </span>
              </td>
              <td className="px-4 py-3 text-right hidden md:table-cell">
                <FormatValue value={plan.totalCurrentValue} />
              </td>
              <td className="px-4 py-3 text-right hidden md:table-cell">
                <FormatValue value={plan.totalTargetValue} />
              </td>
              <td className="px-4 py-3 text-center">
                <StatusBadge
                  status={plan.status}
                  i18nPrefix="rebalance.plans.status"
                />
              </td>
              <td className="px-4 py-3 text-gray-500 text-sm hidden lg:table-cell">
                {formatDate(plan.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default RebalancePlanList
