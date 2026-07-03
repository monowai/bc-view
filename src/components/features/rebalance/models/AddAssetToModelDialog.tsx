import React, { useCallback, useState } from "react"
import useSWR from "swr"
import Dialog from "@components/ui/Dialog"
import { AssetOption, Market } from "types/beancounter"
import { AssetWeightWithDetails } from "types/rebalance"
import { marketsKey, simpleFetcher } from "@utils/api/fetchHelper"
import AssetSearch from "@components/features/assets/AssetSearch"
import { useDialogSubmit } from "@hooks/useDialogSubmit"

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
  const [selectedAsset, setSelectedAsset] = useState<AssetOption | null>(null)
  const [selectedMarket, setSelectedMarket] = useState<string>("LOCAL")
  const [weight, setWeight] = useState<number>(10)
  const {
    isSubmitting: isAdding,
    submitError: error,
    handleSubmit,
    setError,
  } = useDialogSubmit({
    fallbackError: "Could not resolve asset. Please try again.",
  })

  // Fetch available markets
  const { data: marketsData } = useSWR<{ data: Market[] }>(
    marketsKey,
    simpleFetcher(marketsKey),
  )

  const knownMarkets = (marketsData?.data || []).map((m) => m.code)

  // Filter out assets already in the model
  const filterExisting = useCallback(
    (results: AssetOption[]): AssetOption[] =>
      results.filter((r) => {
        const identifier = r.assetId || r.value
        return !existingAssetIds.includes(identifier)
      }),
    [existingAssetIds],
  )

  const handleAdd = async (): Promise<void> => {
    if (!selectedAsset || weight <= 0) return
    await handleSubmit(async () => {
      // Resolve the asset to get a real UUID from svc-data
      // This also creates the asset if it doesn't exist and fetches its price.
      // Pass the selected market so a non-US listing (e.g. LON-listed UCITS
      // ETF traded via IBKR in USD) resolves to the right asset row instead
      // of silently falling back to /api/assets/US/{code} — the previous
      // behaviour was the root cause of "Fetch Prices" returning nothing
      // for LON / ASX / NZX picks.
      const resolvedAsset = await resolveAsset(
        selectedAsset.symbol,
        selectedAsset.market,
      )

      if (!resolvedAsset?.id) {
        throw new Error("Could not resolve asset. Please try again.")
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
    })
  }

  /**
   * Resolve asset code to get real UUID from svc-data.
   * Creates the asset if it doesn't exist.
   */
  const resolveAsset = async (
    code: string,
    market?: string,
  ): Promise<{
    id: string
    code: string
    name: string
    market: { code: string }
  } | null> => {
    try {
      const params = new URLSearchParams({ code })
      if (market) params.set("market", market)
      const response = await fetch(`/api/assets/resolve?${params.toString()}`)
      if (!response.ok) {
        console.warn("Failed to resolve asset:", code, response.status)
        return null
      }
      const data = await response.json()
      return data.data
    } catch (error) {
      console.warn("Error resolving asset:", code, error)
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
    <Dialog
      title={"Add Asset"}
      onClose={handleClose}
      maxWidth="md"
      footer={
        <>
          <Dialog.CancelButton onClick={handleClose} label={"Cancel"} />
          <Dialog.SubmitButton
            onClick={handleAdd}
            label={"Add"}
            loadingLabel={"Adding..."}
            isSubmitting={isAdding}
            disabled={!selectedAsset || weight <= 0}
            variant="blue"
          />
        </>
      }
    >
      <Dialog.ErrorAlert message={error} />
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {"Search Asset"}
        </label>
        <div className="flex gap-2">
          <select
            value={selectedMarket}
            onChange={(e) => {
              setSelectedMarket(e.target.value)
              setSelectedAsset(null)
            }}
            className="border border-gray-300 rounded-md px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="LOCAL">{"All Markets"}</option>
            {(marketsData?.data || []).map((market) => (
              <option key={market.code} value={market.code}>
                {market.code}
              </option>
            ))}
          </select>
          <div className="flex-1">
            <AssetSearch
              key={`${selectedMarket}-${existingAssetIds.join(",")}`}
              market={selectedMarket === "LOCAL" ? undefined : selectedMarket}
              knownMarkets={knownMarkets}
              value={selectedAsset}
              onSelect={setSelectedAsset}
              filterResults={filterExisting}
              placeholder={"Type asset symbol or name..."}
              usePortal
            />
          </div>
        </div>
      </div>

      {selectedAsset && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {"Target Weight (%)"}
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
    </Dialog>
  )
}

export default AddAssetToModelDialog
