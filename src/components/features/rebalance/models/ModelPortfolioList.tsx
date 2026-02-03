import React from "react"
import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
import { ModelDto } from "types/rebalance"
import { useModels } from "../hooks/useModels"
import { TableSkeletonLoader } from "@components/ui/SkeletonLoader"

interface ModelListProps {
  onSelect?: (model: ModelDto) => void
  selectable?: boolean
  selectedId?: string
}

const ModelPortfolioList: React.FC<ModelListProps> = ({
  onSelect,
  selectable = false,
  selectedId,
}) => {
  const { t } = useTranslation("common")
  const router = useRouter()
  const { models, isLoading, error, mutate } = useModels()

  const handleDelete = async (modelId: string): Promise<void> => {
    if (
      !window.confirm(t("rebalance.models.deleteConfirm", "Delete this model?"))
    ) {
      return
    }
    try {
      const response = await fetch(`/api/rebalance/models/${modelId}`, {
        method: "DELETE",
      })
      if (response.ok) {
        mutate()
      }
    } catch (err) {
      console.error("Failed to delete model:", err)
    }
  }

  if (isLoading) {
    return <TableSkeletonLoader rows={3} />
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {t("rebalance.models.loadError", "Failed to load models")}
      </div>
    )
  }

  if (models.length === 0) {
    return (
      <div className="border border-gray-200 rounded-lg p-8 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-100 rounded-full mb-3">
          <i className="fas fa-balance-scale text-2xl text-emerald-600"></i>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          {t("rebalance.models.empty", "No investment models yet")}
        </h3>
        <p className="text-sm text-gray-600 max-w-md mx-auto mb-4">
          {t(
            "rebalance.models.emptyDescription",
            "Define target allocations for your investments",
          )}
        </p>
        <button
          onClick={() => router.push("/rebalance/models/__NEW__")}
          className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700 transition-colors inline-flex items-center"
        >
          <i className="fas fa-plus mr-2"></i>
          {t("rebalance.models.create", "Create Model")}
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
      <table className="min-w-full">
        <thead className="bg-gray-100">
          <tr className="border-b border-gray-200">
            {selectable && <th className="px-4 py-3 w-10"></th>}
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
              {t("rebalance.models.name", "Model Name")}
            </th>
            <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 hidden sm:table-cell">
              {t("rebalance.models.objective", "Objective")}
            </th>
            <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
              {t("rebalance.models.plans", "Plans")}
            </th>
            <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
              {t("rebalance.models.currentPlan", "Current Plan")}
            </th>
            <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
              {t("rebalance.models.currency", "Currency")}
            </th>
            {!selectable && (
              <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                {t("actions", "Actions")}
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {models.map((model) => (
            <tr
              key={model.id}
              onClick={() => {
                if (selectable && onSelect) {
                  onSelect(model)
                } else if (!selectable) {
                  router.push(`/rebalance/models/${model.id}`)
                }
              }}
              className={`hover:bg-slate-100 transition-colors cursor-pointer ${
                selectable && selectedId === model.id ? "bg-emerald-50" : ""
              }`}
            >
              {selectable && (
                <td className="px-4 py-3">
                  <input
                    type="radio"
                    name="selectedModel"
                    checked={selectedId === model.id}
                    onChange={() => onSelect?.(model)}
                    className="w-4 h-4 text-emerald-600"
                  />
                </td>
              )}
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-emerald-600">
                    {model.name}
                  </span>
                  {model.shared && !model.isOwner && (
                    <span
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700"
                      title={t(
                        "rebalance.models.sharedReadOnly",
                        "Shared model (read-only)",
                      )}
                    >
                      <i className="fas fa-share-alt mr-1 text-[10px]"></i>
                      {t("rebalance.models.shared", "Shared")}
                    </span>
                  )}
                </div>
                {model.description && (
                  <p className="text-xs text-gray-500 mt-1 truncate max-w-xs">
                    {model.description}
                  </p>
                )}
              </td>
              <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                <span className="truncate max-w-xs block">
                  {model.objective || "-"}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className="bg-gray-100 px-2 py-1 rounded text-sm">
                  {model.planCount}
                </span>
              </td>
              <td className="px-4 py-3 text-center">
                {model.currentPlanVersion ? (
                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-sm">
                    v{model.currentPlanVersion}
                  </span>
                ) : (
                  <span className="bg-gray-100 text-gray-500 px-2 py-1 rounded text-sm">
                    {t("rebalance.models.noPlan", "None")}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-center text-gray-600">
                {model.baseCurrency}
              </td>
              {!selectable && (
                <td className="px-4 py-3">
                  {model.isOwner !== false ? (
                    <div className="flex items-center justify-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          router.push(`/rebalance/models/${model.id}`)
                        }}
                        className="text-emerald-500 hover:text-emerald-700 transition-colors"
                        title={t("edit", "Edit")}
                      >
                        <i className="far fa-edit"></i>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(model.id)
                        }}
                        className="text-red-500 hover:text-red-700 transition-colors"
                        title={t("delete", "Delete")}
                      >
                        <i className="far fa-trash-alt"></i>
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <span className="text-gray-400 text-sm">
                        <i className="fas fa-eye"></i>
                      </span>
                    </div>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default ModelPortfolioList
