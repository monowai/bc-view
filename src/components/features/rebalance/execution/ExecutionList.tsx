import React, { useState } from "react"
import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
import { useExecutions } from "../hooks/useExecutions"
import { TableSkeletonLoader } from "@components/ui/SkeletonLoader"
import StatusBadge from "../common/StatusBadge"
import { FormatValue } from "@components/ui/MoneyUtils"
import { formatDate } from "@utils/formatters"
import ConfirmDialog from "@components/ui/ConfirmDialog"

const ExecutionList: React.FC = () => {
  const { t } = useTranslation("common")
  const router = useRouter()
  const { executions, isLoading, error } = useExecutions()
  const [deleteExecutionId, setDeleteExecutionId] = useState<string | null>(null)

  if (isLoading) {
    return <TableSkeletonLoader rows={3} />
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {t("rebalance.executions.error", "Failed to load executions")}
      </div>
    )
  }

  if (executions.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <i className="fas fa-tasks text-4xl text-gray-400 mb-4"></i>
        <p className="text-gray-600 mb-4">
          {t("rebalance.executions.empty", "No saved executions yet")}
        </p>
        <p className="text-sm text-gray-500">
          {t(
            "rebalance.executions.emptyHint",
            "Start a rebalance from the Holdings page to create an execution plan.",
          )}
        </p>
      </div>
    )
  }

  const handleRowClick = (executionId: string): void => {
    router.push(`/rebalance/execute?executionId=${executionId}`)
  }

  const handleDeleteConfirm = async (): Promise<void> => {
    if (!deleteExecutionId) return
    try {
      const response = await fetch(
        `/api/rebalance/executions/${deleteExecutionId}`,
        { method: "DELETE" },
      )
      if (response.ok) {
        window.location.reload()
      }
    } catch (err) {
      console.error("Failed to delete execution:", err)
    }
  }

  return (
    <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
      <table className="min-w-full">
        <thead className="bg-gray-100">
          <tr className="border-b border-gray-200">
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
              {t("rebalance.executions.name", "Execution")}
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 hidden sm:table-cell">
              {t("rebalance.executions.model", "Model")}
            </th>
            <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
              {t("rebalance.executions.portfolios", "Portfolios")}
            </th>
            <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 hidden md:table-cell">
              {t("rebalance.executions.value", "Value")}
            </th>
            <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
              {t("rebalance.executions.status", "Status")}
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 hidden lg:table-cell">
              {t("rebalance.executions.updated", "Updated")}
            </th>
            <th className="px-4 py-3 w-12"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {executions.map((execution) => (
            <tr
              key={execution.id}
              onClick={() => handleRowClick(execution.id)}
              className="hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <td className="px-4 py-3">
                <span className="font-medium text-blue-600">
                  {execution.name || `Plan v${execution.planVersion}`}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                {execution.modelName}
              </td>
              <td className="px-4 py-3 text-center">
                <span className="bg-gray-100 px-2 py-1 rounded text-sm">
                  {execution.portfolioCount}
                </span>
              </td>
              <td className="px-4 py-3 text-right hidden md:table-cell">
                <FormatValue value={execution.snapshotTotalValue} />
              </td>
              <td className="px-4 py-3 text-center">
                <StatusBadge
                  status={execution.status}
                  i18nPrefix="rebalance.execution.status"
                />
              </td>
              <td className="px-4 py-3 text-gray-500 text-sm hidden lg:table-cell">
                {formatDate(execution.updatedAt)}
              </td>
              <td className="px-4 py-3">
                {execution.status === "DRAFT" && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteExecutionId(execution.id)
                    }}
                    className="text-gray-400 hover:text-red-600 p-1"
                    title={t("delete", "Delete")}
                  >
                    <i className="fas fa-trash-alt"></i>
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {deleteExecutionId && (
        <ConfirmDialog
          title={t("rebalance.executions.deleteTitle", "Delete Execution")}
          message={t(
            "rebalance.executions.confirmDelete",
            "Delete this execution?",
          )}
          confirmLabel={t("delete", "Delete")}
          cancelLabel={t("cancel", "Cancel")}
          variant="red"
          onConfirm={async () => {
            await handleDeleteConfirm()
            setDeleteExecutionId(null)
          }}
          onCancel={() => setDeleteExecutionId(null)}
        />
      )}
    </div>
  )
}

export default ExecutionList
