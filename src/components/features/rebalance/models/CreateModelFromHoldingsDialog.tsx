import React, { useState, useMemo } from "react"
import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
import WeightsSummary from "../common/WeightsSummary"
import { AssetWeightWithDetails, ModelDto } from "types/rebalance"
import { Holdings, Position } from "types/beancounter"

interface CreateModelFromHoldingsDialogProps {
  modalOpen: boolean
  onClose: () => void
  holdings: Holdings
  portfolioCode: string
  onSuccess?: (model: ModelDto) => void
}

const CreateModelFromHoldingsDialog: React.FC<CreateModelFromHoldingsDialogProps> = ({
  modalOpen,
  onClose,
  holdings,
  portfolioCode,
  onSuccess,
}) => {
  const { t } = useTranslation("common")
  const router = useRouter()

  // Calculate initial weights from holdings
  const initialWeights = useMemo((): AssetWeightWithDetails[] => {
    const positions: Position[] = []
    Object.values(holdings.holdingGroups).forEach((group) => {
      positions.push(...group.positions)
    })

    // Filter out cash-related positions and calculate weights
    const nonCashPositions = positions.filter(
      (p) =>
        p.asset.assetCategory?.id !== "CASH" &&
        p.asset.assetCategory?.id !== "ACCOUNT",
    )

    const totalMarketValue = nonCashPositions.reduce(
      (sum, p) => sum + (p.moneyValues?.PORTFOLIO?.marketValue || 0),
      0,
    )

    if (totalMarketValue === 0) return []

    return nonCashPositions.map((p, index) => ({
      assetId: p.asset.id,
      assetCode: p.asset.code,
      assetName: p.asset.name,
      weight: Math.round(
        ((p.moneyValues?.PORTFOLIO?.marketValue || 0) / totalMarketValue) * 10000,
      ) / 100, // Round to 2 decimal places
      currentValue: p.moneyValues?.PORTFOLIO?.marketValue || 0,
      currentWeight:
        ((p.moneyValues?.PORTFOLIO?.marketValue || 0) / totalMarketValue) * 100,
      sortOrder: index,
    }))
  }, [holdings])

  const [name, setName] = useState(`${portfolioCode} Model`)
  const [objective, setObjective] = useState("")
  const [description, setDescription] = useState("")
  const [weights, setWeights] = useState<AssetWeightWithDetails[]>(initialWeights)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0)
  const isValid = name.trim() !== "" && Math.abs(totalWeight - 100) < 0.01

  const handleNormalize = (): void => {
    if (totalWeight === 0) return
    const factor = 100 / totalWeight
    const normalized = weights.map((w) => ({
      ...w,
      weight: Math.round(w.weight * factor * 100) / 100,
    }))
    setWeights(normalized)
  }

  const handleSubmit = async (): Promise<void> => {
    if (!isValid) return

    setIsSubmitting(true)
    setError(null)

    try {
      // Step 1: Create the Model (metadata only)
      const modelPayload = {
        name: name.trim(),
        objective: objective.trim() || undefined,
        description: description.trim() || undefined,
        baseCurrency: holdings.portfolio.currency.code,
      }

      const modelResponse = await fetch("/api/rebalance/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(modelPayload),
      })

      if (!modelResponse.ok) {
        const errorData = await modelResponse.json().catch(() => ({}))
        setError(errorData.message || "Failed to create model")
        return
      }

      const modelResult = await modelResponse.json()
      const model: ModelDto = modelResult.data

      // Step 2: Create a Plan with the weights
      const planPayload = {
        description: `Initial plan from ${portfolioCode} holdings`,
        assets: weights.map((w, index) => ({
          assetId: w.assetId,
          weight: Math.round(w.weight * 100) / 10000, // Convert from percentage to decimal, rounded
          sortOrder: w.sortOrder ?? index,
        })),
      }

      const planResponse = await fetch(`/api/rebalance/models/${model.id}/plans`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(planPayload),
      })

      if (!planResponse.ok) {
        // Plan creation failed, but model was created - navigate to it anyway
        console.error("Failed to create plan:", await planResponse.text())
      }

      if (onSuccess) {
        onSuccess(model)
      } else {
        // Navigate to the new model
        router.push(`/rebalance/models/${model.id}`)
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create model")
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!modalOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black opacity-50"
        onClick={onClose}
      ></div>
      <div
        className="bg-white rounded-lg shadow-lg w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden z-50 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex justify-between items-center border-b p-4">
          <h2 className="text-xl font-semibold">
            {t("rebalance.models.createFromHoldings", "Create Model from Holdings")}
          </h2>
          <button
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            onClick={onClose}
          >
            &times;
          </button>
        </header>

        <div className="p-4 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 mb-4">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label
                htmlFor="modelName"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t("rebalance.models.name", "Model Name")} *
              </label>
              <input
                id="modelName"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="modelObjective"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t("rebalance.models.objective", "Investment Objective")}
              </label>
              <input
                id="modelObjective"
                type="text"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder={t("rebalance.models.objectivePlaceholder", "e.g., Long-term growth")}
              />
            </div>

            <div>
              <label
                htmlFor="modelDescription"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {t("rebalance.models.description", "Description")}
              </label>
              <input
                id="modelDescription"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder={t("rebalance.models.descriptionPlaceholder", "Optional description")}
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="flex items-center gap-2 text-blue-700">
                <i className="fas fa-info-circle"></i>
                <span className="text-sm">
                  {t(
                    "rebalance.models.fromHoldingsInfo",
                    "This will create a Model and a Draft Plan with weights from your holdings.",
                  )}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
                {t("rebalance.plans.allocations", "Target Allocations")}
              </label>
              {weights.length > 0 && Math.abs(totalWeight - 100) > 0.01 && (
                <button
                  type="button"
                  onClick={handleNormalize}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  {t("rebalance.models.normalize", "Normalize to 100%")}
                </button>
              )}
            </div>

            {weights.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-500">
                {t(
                  "rebalance.models.noEligibleAssets",
                  "No eligible assets found in holdings",
                )}
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {weights.map((weight, index) => (
                  <div
                    key={weight.assetId}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">
                        {weight.assetCode}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {weight.assetName}
                      </div>
                    </div>
                    <div className="text-xs text-gray-400">
                      {weight.currentWeight?.toFixed(1)}%
                    </div>
                    <div className="flex items-center gap-1">
                      <i className="fas fa-arrow-right text-gray-400 text-xs"></i>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={weight.weight}
                        onChange={(e) => {
                          const value = parseFloat(e.target.value) || 0
                          const updated = [...weights]
                          updated[index] = {
                            ...updated[index],
                            weight: Math.round(value * 100) / 100, // Round to 2dp
                          }
                          setWeights(updated)
                        }}
                        className="w-20 px-2 py-1 text-right border border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500"
                      />
                      <span className="text-gray-500">%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {weights.length > 0 && (
              <WeightsSummary
                totalWeight={totalWeight}
                assetCount={weights.length}
              />
            )}
          </div>
        </div>

        <footer className="flex justify-end space-x-2 p-4 border-t bg-gray-50">
          <button
            type="button"
            className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 transition-colors"
            onClick={onClose}
          >
            {t("cancel", "Cancel")}
          </button>
          <button
            type="button"
            className={`px-4 py-2 rounded text-white transition-colors ${
              isValid && !isSubmitting
                ? "bg-blue-500 hover:bg-blue-600"
                : "bg-gray-400 cursor-not-allowed"
            }`}
            onClick={handleSubmit}
            disabled={!isValid || isSubmitting}
          >
            {isSubmitting ? (
              <span className="flex items-center">
                <i className="fas fa-spinner fa-spin mr-2"></i>
                {t("creating", "Creating...")}
              </span>
            ) : (
              t("rebalance.models.create", "Create Model")
            )}
          </button>
        </footer>
      </div>
    </div>
  )
}

export default CreateModelFromHoldingsDialog
