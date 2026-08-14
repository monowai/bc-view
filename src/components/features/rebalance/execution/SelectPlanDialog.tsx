import React, { useState } from "react"
import Dialog from "@components/ui/Dialog"
import Spinner from "@components/ui/Spinner"
import ModelCard from "@components/features/rebalance/common/ModelCard"
import { useApprovedModels } from "@components/features/rebalance/hooks/useApprovedModels"
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
  const [selectedModelId, setSelectedModelId] = useState<string | null>(null)
  const [loadingPlan, setLoadingPlan] = useState(false)
  const [filterByModel, setFilterByModel] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch models with an approved current plan
  const { approvedModels: modelsWithApprovedPlans, isLoading: loadingModels } =
    useApprovedModels(modalOpen)

  const handleSelectModel = async (model: ModelDto): Promise<void> => {
    if (!model.currentPlanId) return

    setSelectedModelId(model.id)
    setLoadingPlan(true)
    setError(null)

    try {
      // Fetch the approved plan
      const response = await fetch(
        `/api/rebalance/models/${model.id}/plans/approved`,
      )
      if (response.ok) {
        const planData = await response.json()
        onSelectPlan(model, planData.data, filterByModel)
      } else {
        const errorData = await response.json().catch(() => ({}))
        setError(
          typeof errorData.message === "string"
            ? errorData.message
            : `Failed to load plan: ${response.status}`,
        )
      }
    } catch (err) {
      console.error("Failed to fetch plan:", err)
      setError(err instanceof Error ? err.message : "Failed to fetch plan")
    } finally {
      setLoadingPlan(false)
      setSelectedModelId(null)
    }
  }

  if (!modalOpen) return null

  return (
    <Dialog
      title={"Select Rebalance Plan"}
      onClose={onClose}
      maxWidth="lg"
      scrollable={true}
      footer={<Dialog.CancelButton onClick={onClose} label={"Cancel"} />}
    >
      <Dialog.ErrorAlert message={error} />

      <p className="text-sm text-gray-600 mb-4">
        {
          "Choose an approved model plan to rebalance against, or create a new model from your current holdings."
        }
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
              {"Model positions only"}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {filterByModel
                ? "Only positions from transactions tagged with this model will be considered. Use this when rebalancing an existing model allocation."
                : "All portfolio positions will be considered. Use this when applying a model to a portfolio for the first time."}
            </div>
          </div>
        </label>
      </div>

      {loadingModels ? (
        <div className="py-8 text-center text-gray-500">
          <Spinner className="mr-2" />
          {"Loading..."}
        </div>
      ) : modelsWithApprovedPlans.length === 0 ? (
        <div className="py-8 text-center">
          <div className="text-gray-500 mb-4">
            <i className="fas fa-folder-open text-4xl mb-2"></i>
            <p>
              {
                "No approved plans found. Create a model and approve a plan first."
              }
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-2 mb-4">
          {modelsWithApprovedPlans.map((model) => (
            <ModelCard
              key={model.id}
              model={model}
              variant="list"
              selected={selectedModelId === model.id}
              onClick={() => handleSelectModel(model)}
              disabled={loadingPlan}
              loading={selectedModelId === model.id && loadingPlan}
            />
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
                {"Create New Model"}
              </div>
              <div className="text-sm text-gray-500">
                {"Create a model from your current holdings"}
              </div>
            </div>
          </div>
        </button>
      </div>
    </Dialog>
  )
}

export default SelectPlanDialog
