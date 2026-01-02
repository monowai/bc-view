import React, { useState, useRef, useEffect } from "react"
import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
import { useModelPlans } from "../hooks/useModelPlans"
import { PlanDto } from "types/rebalance"
import StatusBadge from "../common/StatusBadge"
import { formatDate } from "@utils/formatters"

interface ModelPlansProps {
  modelId: string
}

const ModelPlans: React.FC<ModelPlansProps> = ({ modelId }) => {
  const { t } = useTranslation("common")
  const router = useRouter()
  const { plans, isLoading, error, mutate } = useModelPlans(modelId)
  const [creating, setCreating] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleCreatePlan = async (sourcePlanId?: string): Promise<void> => {
    setCreating(true)
    setShowDropdown(false)
    try {
      const response = await fetch(`/api/rebalance/models/${modelId}/plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sourcePlanId ? { sourcePlanId } : {}),
      })
      if (response.ok) {
        const result = await response.json()
        mutate()
        // Navigate to the new plan
        router.push(`/rebalance/models/${modelId}/plans/${result.data.id}`)
      }
    } catch (err) {
      console.error("Failed to create plan:", err)
    } finally {
      setCreating(false)
    }
  }

  // Get the latest approved plan for copying
  const latestApprovedPlan = plans.find((p) => p.status === "APPROVED")
  const latestPlan = plans[0] // Plans are ordered by version desc

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <i className="fas fa-spinner fa-spin text-gray-400 text-xl"></i>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {t("rebalance.plans.error", "Failed to load plans")}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-900">
          {t("rebalance.plans.title", "Plans")}
        </h2>
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            disabled={creating}
            className="bg-violet-600 text-white px-3 py-1.5 rounded text-sm hover:bg-violet-700 transition-colors flex items-center disabled:opacity-50"
          >
            {creating ? (
              <i className="fas fa-spinner fa-spin mr-2"></i>
            ) : (
              <i className="fas fa-plus mr-2"></i>
            )}
            {t("rebalance.plans.create", "Create Plan")}
            <i className="fas fa-chevron-down ml-2 text-xs"></i>
          </button>

          {showDropdown && (
            <div className="absolute right-0 mt-1 w-56 bg-white rounded-md shadow-lg border border-gray-200 z-10">
              <div className="py-1">
                <button
                  onClick={() => handleCreatePlan()}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                >
                  <i className="fas fa-file mr-3 text-gray-400 w-4"></i>
                  {t("rebalance.plans.createEmpty", "Empty Plan")}
                </button>
                {latestApprovedPlan && (
                  <button
                    onClick={() => handleCreatePlan(latestApprovedPlan.id)}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                  >
                    <i className="fas fa-copy mr-3 text-gray-400 w-4"></i>
                    {t("rebalance.plans.copyFromApproved", "Copy from v{{version}}", {
                      version: latestApprovedPlan.version,
                    })}
                    <span className="ml-auto text-xs text-green-600">
                      {t("rebalance.plans.approved", "Approved")}
                    </span>
                  </button>
                )}
                {latestPlan && latestPlan.id !== latestApprovedPlan?.id && (
                  <button
                    onClick={() => handleCreatePlan(latestPlan.id)}
                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                  >
                    <i className="fas fa-copy mr-3 text-gray-400 w-4"></i>
                    {t("rebalance.plans.copyFromLatest", "Copy from v{{version}}", {
                      version: latestPlan.version,
                    })}
                    <span className="ml-auto text-xs text-yellow-600">
                      {t("rebalance.plans.draft", "Draft")}
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {plans.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <i className="fas fa-clipboard-list text-gray-300 text-3xl mb-3"></i>
          <p className="text-gray-600 mb-4">
            {t("rebalance.plans.empty", "No plans yet")}
          </p>
          <p className="text-sm text-gray-500">
            {t(
              "rebalance.plans.emptyDesc",
              "Create a plan to define target allocations for rebalancing.",
            )}
          </p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t("rebalance.plans.version", "Version")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t("rebalance.plans.status", "Status")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t("rebalance.plans.created", "Created")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t("rebalance.plans.approved", "Approved")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {t("rebalance.plans.assets", "Assets")}
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {plans.map((plan: PlanDto) => (
                <tr
                  key={plan.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() =>
                    router.push(`/rebalance/models/${modelId}/plans/${plan.id}`)
                  }
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className="font-medium text-gray-900">
                      v{plan.version}
                    </span>
                    {plan.description && (
                      <span className="text-sm text-gray-500 ml-2">
                        {plan.description}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <StatusBadge
                      status={plan.status}
                      i18nPrefix="rebalance.plans.status"
                    />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(plan.createdAt)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {plan.approvedAt ? formatDate(plan.approvedAt) : "-"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {plan.assets.length}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-right">
                    <i className="fas fa-chevron-right text-gray-400"></i>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default ModelPlans
