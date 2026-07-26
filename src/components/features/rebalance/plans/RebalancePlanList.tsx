import React, { useState } from "react"
import Alert from "@components/ui/Alert"
import { useRouter } from "next/router"
import { useAllPlans } from "../hooks/useAllPlans"
import { PlanDto } from "types/rebalance"
import { TableSkeletonLoader } from "@components/ui/SkeletonLoader"
import StatusBadge from "../common/StatusBadge"
import { formatDate } from "@utils/formatters"
import ConfirmDialog from "@components/ui/ConfirmDialog"
import { tableBase, theadBase, thBase, tbodyBase } from "@utils/tableStyles"
import Spinner from "@components/ui/Spinner"

const RebalancePlanList: React.FC = () => {
  const router = useRouter()
  const { plans, isLoading, error, mutate } = useAllPlans()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PlanDto | null>(null)

  const handleDeleteConfirm = async (): Promise<void> => {
    if (!deleteTarget) return
    setDeletingId(deleteTarget.id)
    try {
      const response = await fetch(
        `/api/rebalance/models/${deleteTarget.modelId}/plans/${deleteTarget.id}`,
        { method: "DELETE" },
      )
      if (response.ok || response.status === 204) {
        await mutate()
      }
    } catch (err) {
      console.error("Failed to delete plan:", err)
    } finally {
      setDeletingId(null)
      setDeleteTarget(null)
    }
  }

  if (isLoading) {
    return <TableSkeletonLoader rows={3} />
  }

  if (error) {
    return <Alert variant="error">{"Failed to load plans"}</Alert>
  }

  if (plans.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <i className="fas fa-balance-scale text-4xl text-gray-400 mb-4"></i>
        <p className="text-gray-600 mb-4">{"No rebalance plans yet"}</p>
        <button
          onClick={() => router.push("/rebalance/wizard")}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors"
        >
          {"Create Plan"}
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
      <table className={tableBase}>
        <thead className={theadBase}>
          <tr>
            <th className={thBase}>{"Model"}</th>
            <th className={thBase}>{"Version"}</th>
            <th className={thBase}>{"Status"}</th>
            <th className={thBase}>{"Assets"}</th>
            <th className={thBase}>{"Created"}</th>
            <th className={thBase}>{"Approved"}</th>
            <th className="px-4 py-3 w-12"></th>
          </tr>
        </thead>
        <tbody className={`bg-white ${tbodyBase}`}>
          {plans.map((plan) => (
            <tr
              key={plan.id}
              onClick={() =>
                router.push(
                  `/rebalance/models/${plan.modelId}/plans/${plan.id}`,
                )
              }
              className="hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <td className="px-4 py-3">
                <span className="font-medium text-blue-600">
                  {plan.modelName}
                </span>
                {plan.description && (
                  <span className="text-sm text-gray-500 ml-2">
                    {plan.description}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">v{plan.version}</td>
              <td className="px-4 py-3 text-center">
                <StatusBadge
                  status={plan.status}
                  i18nPrefix="rebalance.plans.status"
                />
              </td>
              <td className="px-4 py-3 text-center">{plan.assets.length}</td>
              <td className="px-4 py-3 text-gray-500 text-sm whitespace-nowrap">
                {formatDate(plan.createdAt)}
              </td>
              <td className="px-4 py-3 text-gray-500 text-sm whitespace-nowrap">
                {plan.approvedAt ? formatDate(plan.approvedAt) : "-"}
              </td>
              <td className="px-4 py-3">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setDeleteTarget(plan)
                  }}
                  disabled={deletingId === plan.id}
                  className="text-gray-400 hover:text-red-600 p-1 disabled:opacity-50"
                  title={"Delete"}
                >
                  {deletingId === plan.id ? (
                    <Spinner />
                  ) : (
                    <i className="fas fa-trash-alt"></i>
                  )}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {deleteTarget && (
        <ConfirmDialog
          title={"Delete Plan"}
          message={"Delete this plan?"}
          confirmLabel={"Delete"}
          cancelLabel={"Cancel"}
          variant="red"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

export default RebalancePlanList
