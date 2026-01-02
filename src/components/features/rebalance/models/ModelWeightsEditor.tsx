import React, { useState } from "react"
import { useTranslation } from "next-i18next"
import AssetWeightInput from "../common/AssetWeightInput"
import WeightsSummary from "../common/WeightsSummary"
import AddAssetToModelDialog from "./AddAssetToModelDialog"
import { AssetWeightWithDetails } from "types/rebalance"

interface ModelWeightsEditorProps {
  weights: AssetWeightWithDetails[]
  onChange: (weights: AssetWeightWithDetails[]) => void
  onFromHoldings?: () => void
  onFetchPrices?: () => void
  fetchingPrices?: boolean
  readOnly?: boolean
  showPrice?: boolean
}

const ModelWeightsEditor: React.FC<ModelWeightsEditorProps> = ({
  weights,
  onChange,
  onFromHoldings,
  onFetchPrices,
  fetchingPrices = false,
  readOnly = false,
  showPrice = false,
}) => {
  const { t } = useTranslation("common")
  const [addAssetModalOpen, setAddAssetModalOpen] = useState(false)

  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0)
  const existingAssetIds = weights.map((w) => w.assetId)

  const handleWeightChange = (index: number, newWeight: number): void => {
    const updated = [...weights]
    updated[index] = { ...updated[index], weight: newWeight }
    onChange(updated)
  }

  const handleRationaleChange = (index: number, rationale: string): void => {
    const updated = [...weights]
    updated[index] = { ...updated[index], rationale }
    onChange(updated)
  }

  const handlePriceChange = (index: number, price: number | undefined): void => {
    const updated = [...weights]
    updated[index] = { ...updated[index], capturedPrice: price }
    onChange(updated)
  }

  const handleRemove = (index: number): void => {
    const updated = weights.filter((_, i) => i !== index)
    onChange(updated)
  }

  const handleNormalize = (): void => {
    if (totalWeight === 0) return
    const factor = 100 / totalWeight
    const normalized = weights.map((w) => ({
      ...w,
      weight: Math.round(w.weight * factor * 100) / 100,
    }))
    onChange(normalized)
  }

  const handleAddAsset = (newAsset: AssetWeightWithDetails): void => {
    const updated = [
      ...weights,
      { ...newAsset, sortOrder: weights.length },
    ]
    onChange(updated)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          {t("rebalance.models.weights", "Asset Weights")}
        </label>
        <div className="flex items-center gap-3">
          {!readOnly && weights.length > 0 && Math.abs(totalWeight - 100) > 0.01 && (
            <button
              type="button"
              onClick={handleNormalize}
              className="text-sm text-blue-600 hover:text-blue-800"
            >
              {t("rebalance.models.normalize", "Normalize to 100%")}
            </button>
          )}
          {!readOnly && (
            <>
              {onFromHoldings && (
                <button
                  type="button"
                  onClick={onFromHoldings}
                  className="text-sm text-gray-700 bg-gray-100 px-3 py-1 rounded hover:bg-gray-200 transition-colors flex items-center"
                >
                  <i className="fas fa-chart-pie mr-1"></i>
                  {t("rebalance.models.fromHoldings", "From Holdings")}
                </button>
              )}
              {showPrice && onFetchPrices && weights.length > 0 && (
                <button
                  type="button"
                  onClick={onFetchPrices}
                  disabled={fetchingPrices}
                  className="text-sm text-gray-700 bg-gray-100 px-3 py-1 rounded hover:bg-gray-200 transition-colors flex items-center disabled:opacity-50"
                >
                  <i className={`fas ${fetchingPrices ? "fa-spinner fa-spin" : "fa-sync-alt"} mr-1`}></i>
                  {t("rebalance.plans.fetchPrices", "Fetch Prices")}
                </button>
              )}
              <button
                type="button"
                onClick={() => setAddAssetModalOpen(true)}
                className="text-sm bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 transition-colors flex items-center"
              >
                <i className="fas fa-plus mr-1"></i>
                {t("rebalance.models.addAsset", "Add Asset")}
              </button>
            </>
          )}
        </div>
      </div>

      {weights.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-500">
          {t("rebalance.models.noWeights", "No assets added yet")}
        </div>
      ) : (
        <div className="space-y-2">
          {weights.map((weight, index) => (
            <AssetWeightInput
              key={weight.assetId}
              assetId={weight.assetId}
              assetCode={weight.assetCode}
              assetName={weight.assetName}
              weight={weight.weight}
              rationale={weight.rationale}
              capturedPrice={weight.capturedPrice}
              priceCurrency={weight.priceCurrency}
              onChange={(newWeight) => handleWeightChange(index, newWeight)}
              onRationaleChange={(rationale) => handleRationaleChange(index, rationale)}
              onPriceChange={(price) => handlePriceChange(index, price)}
              onRemove={readOnly ? undefined : () => handleRemove(index)}
              readOnly={readOnly}
              showPrice={showPrice}
            />
          ))}
        </div>
      )}

      {weights.length > 0 && (
        <WeightsSummary totalWeight={totalWeight} assetCount={weights.length} />
      )}

      <AddAssetToModelDialog
        modalOpen={addAssetModalOpen}
        onClose={() => setAddAssetModalOpen(false)}
        onAdd={handleAddAsset}
        existingAssetIds={existingAssetIds}
      />
    </div>
  )
}

export default ModelWeightsEditor
