import React, { useState } from "react"
import { useRouter } from "next/router"
import { useModelPlans } from "../hooks/useModelPlans"
import { PlanDto } from "types/rebalance"
import StatusBadge from "../common/StatusBadge"
import { formatDate } from "@utils/formatters"
import ConfirmDialog from "@components/ui/ConfirmDialog"
import { tableBase, theadBase, thBase, tbodyBase } from "@utils/tableStyles"

interface ModelPlansProps {
  modelId: string
}

const ModelPlans: React.FC<ModelPlansProps> = ({ modelId }) => {
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
        {"Failed to load plan"}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-gray-900">
          {"Rebalance Plans"}
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
          {"Create Plan"}
        </button>
      </div>

      {plans.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
          <i className="fas fa-clipboard-list text-gray-300 text-3xl mb-3"></i>
          <p className="text-gray-600 mb-4">{"No rebalance plans yet"}</p>
          <p className="text-sm text-gray-500">
            {"Create a plan to define target allocations for rebalancing."}
          </p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className={tableBase}>
            <thead className={theadBase}>
              <tr>
                <th className={thBase}>
                  {"Version"}
                </th>
                <th className={thBase}>
                  {"Status"}
                </th>
                <th className={thBase}>
                  {"Created"}
                </th>
                <th className={thBase}>
                  {"Approved"}
                </th>
                <th className={thBase}>
                  {"Assets"}
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className={`bg-white ${tbodyBase}`}>
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
                      title={"Delete"}
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
          title={"Delete Plan"}
          message={"Delete this plan?"}
          confirmLabel={"Delete"}
          cancelLabel={"Cancel"}
          variant="red"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeletePlanId(null)}
        />
      )}
    </div>
  )
}

export default ModelPlans
