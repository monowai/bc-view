import React, { useState, useCallback, useRef } from "react"
import { useTranslation } from "next-i18next"
import AsyncSelect from "react-select/async"
import { AssetSearchResult } from "types/beancounter"
import { AssetWeightWithDetails } from "types/rebalance"

interface AssetOption {
  value: string
  label: string
  assetId: string
  assetCode: string
  assetName: string
}

interface AddAssetToModelDialogProps {
  modalOpen: boolean
  onClose: () => void
  onAdd: (asset: AssetWeightWithDetails) => void
  existingAssetIds: string[]
}

const AddAssetToModelDialog: React.FC<AddAssetToModelDialogProps> = ({
  modalOpen,
  onClose,
  onAdd,
  existingAssetIds,
}) => {
  const { t } = useTranslation("common")
  const [selectedAsset, setSelectedAsset] = useState<AssetOption | null>(null)
  const [weight, setWeight] = useState<number>(10)
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const loadOptions = useCallback(
    (inputValue: string, callback: (options: AssetOption[]) => void): void => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }

      if (inputValue.length < 2) {
        callback([])
        return
      }

      debounceRef.current = setTimeout(async () => {
        try {
          const params = new URLSearchParams({ keyword: inputValue })
          const response = await fetch(`/api/assets/search?${params}`)
          if (!response.ok) {
            callback([])
            return
          }

          const data = await response.json()
          const options: AssetOption[] = (data.data || [])
            .filter((result: AssetSearchResult) => {
              // Use assetId if available, otherwise use symbol for uniqueness
              const identifier = result.assetId || result.symbol
              return !existingAssetIds.includes(identifier)
            })
            .map((result: AssetSearchResult) => ({
              value: result.assetId || result.symbol,
              label: `${result.symbol} - ${result.name}`,
              // Use symbol as assetId fallback for search results without persisted assetId
              assetId: result.assetId || result.symbol,
              assetCode: result.symbol,
              assetName: result.name,
            }))
          callback(options)
        } catch {
          callback([])
        }
      }, 300)
    },
    [existingAssetIds],
  )

  const handleAdd = async (): Promise<void> => {
    if (!selectedAsset || weight <= 0) return

    setIsAdding(true)
    setError(null)
    try {
      // Resolve the asset to get a real UUID from svc-data
      // This also creates the asset if it doesn't exist and fetches its price
      const resolvedAsset = await resolveAsset(selectedAsset.assetCode)

      if (!resolvedAsset?.id) {
        setError(
          t(
            "rebalance.models.resolveError",
            "Could not resolve asset. Please try again.",
          ),
        )
        return
      }

      // Format asset code: omit "US:" prefix for US market (default)
      const formatAssetCode = (
        marketCode: string,
        assetCode: string,
      ): string => {
        return marketCode === "US" ? assetCode : `${marketCode}:${assetCode}`
      }

      const newWeight: AssetWeightWithDetails = {
        assetId: resolvedAsset.id,
        assetCode: formatAssetCode(
          resolvedAsset.market.code,
          resolvedAsset.code,
        ),
        assetName: resolvedAsset.name,
        weight: weight,
        sortOrder: 0,
      }
      onAdd(newWeight)
      setSelectedAsset(null)
      setWeight(10)
      onClose()
    } finally {
      setIsAdding(false)
    }
  }

  /**
   * Resolve asset code to get real UUID from svc-data.
   * Creates the asset if it doesn't exist.
   */
  const resolveAsset = async (
    code: string,
  ): Promise<{
    id: string
    code: string
    name: string
    market: { code: string }
  } | null> => {
    try {
      const response = await fetch(`/api/assets/resolve?code=${code}`)
      if (!response.ok) {
        console.warn(`Failed to resolve asset ${code}:`, response.status)
        return null
      }
      const data = await response.json()
      return data.data
    } catch (error) {
      console.warn(`Error resolving asset ${code}:`, error)
      return null
    }
  }

  const handleClose = (): void => {
    setSelectedAsset(null)
    setWeight(10)
    setError(null)
    onClose()
  }

  if (!modalOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black opacity-50"
        onClick={handleClose}
      ></div>
      <div
        className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 z-50"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex justify-between items-center border-b p-4">
          <h2 className="text-lg font-semibold">
            {t("rebalance.models.addAsset", "Add Asset")}
          </h2>
          <button
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            onClick={handleClose}
          >
            &times;
          </button>
        </header>

        <div className="p-4 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("rebalance.models.searchAsset", "Search Asset")}
            </label>
            <AsyncSelect
              key={existingAssetIds.join(",")}
              loadOptions={loadOptions}
              placeholder={t(
                "rebalance.models.searchPlaceholder",
                "Type to search (min 2 chars)...",
              )}
              noOptionsMessage={({ inputValue }) =>
                inputValue.length < 2
                  ? t("rebalance.models.minChars", "Type at least 2 characters")
                  : t("rebalance.models.noResults", "No assets found")
              }
              loadingMessage={() =>
                t("rebalance.models.searching", "Searching...")
              }
              onChange={(selected) =>
                setSelectedAsset(selected as AssetOption | null)
              }
              value={selectedAsset}
              isClearable
              menuPortalTarget={
                typeof document !== "undefined" ? document.body : null
              }
              menuPosition="fixed"
              styles={{
                control: (base) => ({
                  ...base,
                  minHeight: "38px",
                }),
                menuPortal: (base) => ({
                  ...base,
                  zIndex: 9999,
                }),
              }}
            />
          </div>

          {selectedAsset && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t("rebalance.models.targetWeight", "Target Weight (%)")}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0.1"
                  max="100"
                  step="0.1"
                  value={weight}
                  onChange={(e) => setWeight(parseFloat(e.target.value) || 0)}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="text-gray-500">%</span>
              </div>
            </div>
          )}
        </div>

        <footer className="flex justify-end space-x-2 p-4 border-t bg-gray-50">
          <button
            type="button"
            className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 transition-colors"
            onClick={handleClose}
          >
            {t("cancel", "Cancel")}
          </button>
          <button
            type="button"
            className={`px-4 py-2 rounded text-white transition-colors ${
              selectedAsset && weight > 0 && !isAdding
                ? "bg-blue-500 hover:bg-blue-600"
                : "bg-gray-400 cursor-not-allowed"
            }`}
            onClick={handleAdd}
            disabled={!selectedAsset || weight <= 0 || isAdding}
          >
            {isAdding ? (
              <span className="flex items-center">
                <i className="fas fa-spinner fa-spin mr-2"></i>
                {t("adding", "Adding...")}
              </span>
            ) : (
              t("add", "Add")
            )}
          </button>
        </footer>
      </div>
    </div>
  )
}

export default AddAssetToModelDialog
