import React, { useState } from "react"
import { useTranslation } from "next-i18next"
import useSWR from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"
import { ModelDto, PlanDto } from "types/rebalance"

interface SelectPlanDialogProps {
  modalOpen: boolean
  portfolioId: string
  onClose: () => void
  onSelectPlan: (model: ModelDto, plan: PlanDto, filterByModel: boolean) => void
  onCreateNew: () => void
}

const SelectPlanDialog: React.FC<SelectPlanDialogProps> = ({
  modalOpen,
  onClose,
  onSelectPlan,
  onCreateNew,
}) => {
  const { t } = useTranslation("common")
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [loadingPlan, setLoadingPlan] = useState(false)
  const [filterByModel, setFilterByModel] = useState(false)

  // Fetch models
  const { data: modelsData, isLoading: loadingModels } = useSWR(
    modalOpen ? "/api/rebalance/models" : null,
    simpleFetcher("/api/rebalance/models"),
  )

  const models: ModelDto[] = modelsData?.data || []

  // Filter models that have approved plans
  const modelsWithApprovedPlans = models.filter(
    (m) => m.currentPlanId && m.currentPlanVersion,
  )

  const handleSelectModel = async (model: ModelDto): Promise<void> => {
    if (!model.currentPlanId) return

    setSelectedModelId(model.id)
    setLoadingPlan(true)

    try {
      // Fetch the approved plan
      const response = await fetch(
        `/api/rebalance/models/${model.id}/plans/approved`,
      )
      if (response.ok) {
        const planData = await response.json()
        onSelectPlan(model, planData.data, filterByModel)
      }
    } catch (err) {
      console.error("Failed to fetch plan:", err)
    } finally {
      setLoadingPlan(false)
      setSelectedModelId(null)
    }
  }

  if (!modalOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black opacity-50"
        onClick={onClose}
      ></div>
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg mx-auto p-6 z-50 max-h-[80vh] overflow-y-auto">
        <h2 className="text-xl font-semibold mb-2">
          {t("rebalance.selectPlan.title", "Select Rebalance Plan")}
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          {t(
            "rebalance.selectPlan.description",
            "Choose an approved model plan to rebalance against, or create a new model from your current holdings.",
          )}
        </p>

        {/* Model Positions Filter Toggle */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={filterByModel}
              onChange={(e) => setFilterByModel(e.target.checked)}
              className="mt-1 h-4 w-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
            />
            <div className="flex-1">
              <div className="font-medium text-gray-900 text-sm">
                {t("rebalance.filterByModel.label", "Model positions only")}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {filterByModel
                  ? t(
                      "rebalance.filterByModel.enabledDesc",
                      "Only positions from transactions tagged with this model will be considered. Use this when rebalancing an existing model allocation.",
                    )
                  : t(
                      "rebalance.filterByModel.disabledDesc",
                      "All portfolio positions will be considered. Use this when applying a model to a portfolio for the first time.",
                    )}
              </div>
            </div>
          </label>
        </div>

        {loadingModels ? (
          <div className="py-8 text-center text-gray-500">
            <i className="fas fa-spinner fa-spin mr-2"></i>
            {t("loading", "Loading...")}
          </div>
        ) : modelsWithApprovedPlans.length === 0 ? (
          <div className="py-8 text-center">
            <div className="text-gray-500 mb-4">
              <i className="fas fa-folder-open text-4xl mb-2"></i>
              <p>
                {t(
                  "rebalance.selectPlan.noPlans",
                  "No approved plans found. Create a model and approve a plan first.",
                )}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            {modelsWithApprovedPlans.map((model) => (
              <button
                key={model.id}
                onClick={() => handleSelectModel(model)}
                disabled={loadingPlan}
                className={`w-full text-left p-4 border rounded-lg transition-colors ${
                  selectedModelId === model.id
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"
                } disabled:opacity-50`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 truncate">
                      {model.name}
                    </div>
                    {model.objective && (
                      <div className="text-sm text-gray-500 truncate">
                        {model.objective}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                        {model.baseCurrency}
                      </span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                        <i className="fas fa-check-circle mr-1"></i>v
                        {model.currentPlanVersion}
                      </span>
                    </div>
                  </div>
                  {selectedModelId === model.id && loadingPlan ? (
                    <i className="fas fa-spinner fa-spin text-blue-500 ml-2"></i>
                  ) : (
                    <i className="fas fa-chevron-right text-gray-400 ml-2"></i>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        <div className="border-t pt-4 mt-4">
          <button
            onClick={onCreateNew}
            className="w-full text-left p-4 border border-dashed border-gray-300 rounded-lg hover:border-blue-300 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center">
              <i className="fas fa-plus text-blue-500 mr-3"></i>
              <div>
                <div className="font-medium text-gray-900">
                  {t("rebalance.selectPlan.createNew", "Create New Model")}
                </div>
                <div className="text-sm text-gray-500">
                  {t(
                    "rebalance.selectPlan.createNewDesc",
                    "Create a model from your current holdings",
                  )}
                </div>
              </div>
            </div>
          </button>
        </div>

        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
          >
            {t("cancel", "Cancel")}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SelectPlanDialog
