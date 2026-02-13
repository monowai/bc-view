import React, { useState } from "react"
import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
import { useModelPlans } from "../hooks/useModelPlans"
import { PlanDto } from "types/rebalance"
import StatusBadge from "../common/StatusBadge"
import { formatDate } from "@utils/formatters"
import ConfirmDialog from "@components/ui/ConfirmDialog"

interface ModelPlansProps {
  modelId: string
}

const ModelPlans: React.FC<ModelPlansProps> = ({ modelId }) => {
  const { t } = useTranslation("common")
  const router = useRouter()
  const { plans, isLoading, error, mutate } = useModelPlans(modelId)
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deletePlanId, setDeletePlanId] = useState<string | null>(null)

  const handleDeleteConfirm = async (): Promise<void> => {
    if (!deletePlanId) return
    setDeletingId(deletePlanId)
    try {
      const response = await fetch(
        `/api/rebalance/models/${modelId}/plans/${deletePlanId}`,
        { method: "DELETE" },
      )
      if (response.ok || response.status === 204) {
        mutate()
      }
    } catch (err) {
      console.error("Failed to delete plan:", err)
    } finally {
      setDeletingId(null)
      setDeletePlanId(null)
    }
  }

  const handleCreatePlan = async (): Promise<void> => {
    setCreating(true)
    try {
      const response = await fetch(`/api/rebalance/models/${modelId}/plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      if (response.ok) {
        const result = await response.json()
        mutate()
        router.push(`/rebalance/models/${modelId}/plans/${result.data.id}`)
      }
    } catch (err) {
      console.error("Failed to create plan:", err)
    } finally {
      setCreating(false)
    }
  }

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
        <button
          onClick={handleCreatePlan}
          disabled={creating}
          className="bg-violet-600 text-white px-3 py-1.5 rounded text-sm hover:bg-violet-700 transition-colors flex items-center disabled:opacity-50"
        >
          {creating ? (
            <i className="fas fa-spinner fa-spin mr-2"></i>
          ) : (
            <i className="fas fa-plus mr-2"></i>
          )}
          {t("rebalance.plans.create", "Create Plan")}
        </button>
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
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeletePlanId(plan.id)
                      }}
                      disabled={deletingId === plan.id}
                      className="text-gray-400 hover:text-red-600 p-1 mr-2 disabled:opacity-50"
                      title={t("delete", "Delete")}
                    >
                      {deletingId === plan.id ? (
                        <i className="fas fa-spinner fa-spin"></i>
                      ) : (
                        <i className="fas fa-trash-alt"></i>
                      )}
                    </button>
                    <i className="fas fa-chevron-right text-gray-400"></i>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {deletePlanId && (
        <ConfirmDialog
          title={t("rebalance.plans.deleteTitle", "Delete Plan")}
          message={t(
            "rebalance.plans.confirmDelete",
            "Delete this plan?",
          )}
          confirmLabel={t("delete", "Delete")}
          cancelLabel={t("cancel", "Cancel")}
          variant="red"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletePlanId(null)}
        />
      )}
    </div>
  )
}

export default ModelPlans
