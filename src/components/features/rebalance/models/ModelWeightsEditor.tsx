import React, { useState } from "react"
import AssetWeightInput from "../common/AssetWeightInput"
import WeightsSummary from "../common/WeightsSummary"
import AddAssetToModelDialog from "./AddAssetToModelDialog"
import { normalizeWeights } from "@lib/rebalance/weights"
import { AssetWeightWithDetails } from "types/rebalance"

interface ModelWeightsEditorProps {
  weights: AssetWeightWithDetails[]
  onChange: (weights: AssetWeightWithDetails[]) => void
  onFetchPrices?: () => void
  fetchingPrices?: boolean
  readOnly?: boolean
  showPrice?: boolean
  onShowPriceChart?: (weight: AssetWeightWithDetails) => void
  onShowAssetInsight?: (weight: AssetWeightWithDetails) => void
  /** Section heading rendered in the toolbar row, so title and every
   *  action share one line instead of stacking two right-aligned rows. */
  title?: string
  /** Host-page actions (e.g. Copy/Export/Import) merged into the toolbar. */
  extraActions?: React.ReactNode
}

const ModelWeightsEditor: React.FC<ModelWeightsEditorProps> = ({
  weights,
  onChange,
  onFetchPrices,
  fetchingPrices = false,
  readOnly = false,
  showPrice = false,
  onShowPriceChart,
  onShowAssetInsight,
  title,
  extraActions,
}) => {
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

  const handlePriceChange = (
    index: number,
    price: number | undefined,
  ): void => {
    const updated = [...weights]
    updated[index] = { ...updated[index], capturedPrice: price }
    onChange(updated)
  }

  const handleRemove = (index: number): void => {
    const updated = weights.filter((_, i) => i !== index)
    onChange(updated)
  }

  const handleNormalize = (): void => {
    const normalized = normalizeWeights(weights, totalWeight)
    if (!normalized) return
    onChange(normalized)
  }

  const handleAddAsset = (newAsset: AssetWeightWithDetails): void => {
    const updated = [...weights, { ...newAsset, sortOrder: weights.length }]
    onChange(updated)
  }

  const showRowTools = !readOnly && weights.length > 0

  return (
    <div className="space-y-3">
      {/* One toolbar row: title left, every action right. Row tools hide
          while empty — the empty state below carries the Add action. */}
      {(title || extraActions || showRowTools) && (
        <div className="flex flex-wrap items-center justify-between gap-y-2">
          {title && (
            <h2 className="text-lg font-semibold text-gray-900 whitespace-nowrap mr-4">
              {title}
            </h2>
          )}
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            {extraActions}
            {showRowTools && showPrice && onFetchPrices && (
              <button
                type="button"
                // Wrap so the React SyntheticEvent isn't forwarded as the
                // first arg — handleFetchPrices treats arg[0] as
                // `weightsOverride?: AssetWeightWithDetails[]` and would
                // call .filter() on the event, throw TypeError, and the
                // caller's try/catch would swallow it (no network fired).
                onClick={() => onFetchPrices()}
                disabled={fetchingPrices}
                className="text-sm text-gray-700 bg-gray-100 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors flex items-center disabled:opacity-50"
              >
                <i
                  className={`fas ${fetchingPrices ? "fa-spinner fa-spin" : "fa-sync-alt"} mr-1.5`}
                ></i>
                {"Fetch Prices"}
              </button>
            )}
            {showRowTools && (
              <button
                type="button"
                onClick={() => setAddAssetModalOpen(true)}
                className="text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors flex items-center"
              >
                <i className="fas fa-plus mr-1.5"></i>
                {"Add Asset"}
              </button>
            )}
          </div>
        </div>
      )}

      {weights.length === 0 ? (
        <div className="border border-gray-200 rounded-lg py-10 text-center">
          <i className="fas fa-balance-scale text-4xl text-gray-300 mb-3"></i>
          <p className="text-gray-600">{"No assets in this plan yet"}</p>
          <p className="text-sm text-gray-400 mt-1">
            {"Add assets or import holdings to define target allocations."}
          </p>
          {!readOnly && (
            <button
              type="button"
              onClick={() => setAddAssetModalOpen(true)}
              className="mt-4 text-sm bg-invest-600 text-white px-4 py-2 rounded-lg hover:bg-invest-700 transition-colors inline-flex items-center"
            >
              <i className="fas fa-plus mr-2"></i>
              {"Add Asset"}
            </button>
          )}
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
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
              onRationaleChange={(rationale) =>
                handleRationaleChange(index, rationale)
              }
              onPriceChange={(price) => handlePriceChange(index, price)}
              onRemove={readOnly ? undefined : () => handleRemove(index)}
              onShowPriceChart={
                onShowPriceChart ? () => onShowPriceChart(weight) : undefined
              }
              onShowAssetInsight={
                onShowAssetInsight
                  ? () => onShowAssetInsight(weight)
                  : undefined
              }
              readOnly={readOnly}
              showPrice={showPrice}
            />
          ))}
        </div>
      )}

      {weights.length > 0 && (
        <WeightsSummary
          totalWeight={totalWeight}
          assetCount={weights.length}
          onNormalize={readOnly ? undefined : handleNormalize}
        />
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
