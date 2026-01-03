import React from "react"
import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
import ModelPortfolioList from "../../models/ModelPortfolioList"
import { ModelDto } from "types/rebalance"

interface SelectModelStepProps {
  selectedModel: ModelDto | null
  onSelect: (model: ModelDto) => void
}

const SelectModelStep: React.FC<SelectModelStepProps> = ({
  selectedModel,
  onSelect,
}) => {
  const { t } = useTranslation("common")
  const router = useRouter()

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900">
          {t("rebalance.wizard.selectModel", "Select Model Portfolio")}
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          {t(
            "rebalance.wizard.selectModelDesc",
            "Choose an existing model portfolio or create a new one to define your target allocation.",
          )}
        </p>
      </div>

      {/* Create new model button */}
      <div className="flex justify-end">
        <button
          onClick={() => router.push("/rebalance/models/__NEW__")}
          className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
        >
          <i className="fas fa-plus"></i>
          {t("rebalance.models.create", "Create New Model")}
        </button>
      </div>

      {/* Model list */}
      <ModelPortfolioList
        selectable
        onSelect={onSelect}
        selectedId={selectedModel?.id}
      />

      {/* Selected model summary */}
      {selectedModel && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-700 mb-2">
            <i className="fas fa-check-circle"></i>
            <span className="font-medium">
              {t("rebalance.wizard.selectedModel", "Selected Model")}
            </span>
          </div>
          <div className="text-sm">
            <p className="font-medium">{selectedModel.name}</p>
            {selectedModel.objective && (
              <p className="text-gray-600">{selectedModel.objective}</p>
            )}
            {selectedModel.currentPlanVersion ? (
              <p className="text-green-600 mt-1">
                <i className="fas fa-check mr-1"></i>
                {t(
                  "rebalance.wizard.currentPlan",
                  "Current Plan: v{{version}}",
                  {
                    version: selectedModel.currentPlanVersion,
                  },
                )}
              </p>
            ) : (
              <p className="text-amber-600 mt-1">
                <i className="fas fa-exclamation-triangle mr-1"></i>
                {t("rebalance.wizard.noPlan", "No approved plan")}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default SelectModelStep
