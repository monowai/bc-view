import React, { useState } from "react"
import useSWR from "swr"
import Dialog from "@components/ui/Dialog"
import Spinner from "@components/ui/Spinner"
import { fetcher, portfoliosKey } from "@utils/api/fetchHelper"
import WeightsSummary from "../common/WeightsSummary"
import HoldingWeightsEditor from "./HoldingWeightsEditor"
import { toWeightPercent } from "@lib/rebalance/weights"
import { AssetWeightWithDetails } from "types/rebalance"
import { Portfolio } from "types/beancounter"
import { weightsFromHoldingsUrl } from "@utils/api/client/rebalance"

interface HoldingWeightDto {
  assetId: string
  assetCode: string
  assetName: string | null
  marketCode: string | null
  weight: number
  marketValue: number
  price: number
  priceCurrency: string
}

interface ImportHoldingsDialogProps {
  modalOpen: boolean
  modelId: string
  onClose: () => void
  onImport: (weights: AssetWeightWithDetails[]) => void
}

const ImportHoldingsDialog: React.FC<ImportHoldingsDialogProps> = ({
  modalOpen,
  modelId,
  onClose,
  onImport,
}) => {
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<string>("")
  const [loadingWeights, setLoadingWeights] = useState(false)
  const [weights, setWeights] = useState<AssetWeightWithDetails[]>([])
  const [error, setError] = useState<string | null>(null)

  // Fetch portfolios
  const { data: portfoliosData } = useSWR<{ data: Portfolio[] }>(
    modalOpen ? portfoliosKey : null,
    fetcher,
  )
  const portfolios = portfoliosData?.data || []

  // Reset state when the dialog closes. Render-phase "store previous value"
  // pattern: when modalOpen transitions, clear the dialog's local state once
  // without a cascading effect.
  const [prevModalOpen, setPrevModalOpen] = useState(modalOpen)
  if (modalOpen !== prevModalOpen) {
    setPrevModalOpen(modalOpen)
    if (!modalOpen) {
      setSelectedPortfolioId("")
      setWeights([])
      setError(null)
    }
  }

  // Fetch weights from backend when portfolio is selected
  const handlePortfolioSelect = async (portfolioId: string): Promise<void> => {
    setSelectedPortfolioId(portfolioId)
    setError(null)

    if (!portfolioId) {
      setWeights([])
      return
    }

    setLoadingWeights(true)
    try {
      const portfolio = portfolios.find((p) => p.id === portfolioId)
      // Fallback only covers a race against a background portfolios refetch
      // (the dropdown only ever offers ids drawn from `portfolios`, so the
      // lookup above should always hit) — the first portfolio in the
      // currently-known list, never a hard-coded country default (#1156).
      const valueCurrency =
        portfolio?.currency?.code || portfolios[0]?.currency?.code || ""

      const response = await fetch(
        weightsFromHoldingsUrl(modelId, portfolioId, valueCurrency),
      )

      if (response.ok) {
        const result: { data: HoldingWeightDto[] } = await response.json()
        const newWeights: AssetWeightWithDetails[] = result.data.map(
          (w, index) => ({
            assetId: w.assetId,
            assetCode: w.assetCode,
            assetName: w.assetName || undefined,
            weight: toWeightPercent(w.weight),
            currentValue: w.marketValue,
            currentWeight: w.weight * 100,
            capturedPrice: w.price,
            priceCurrency: w.priceCurrency,
            sortOrder: index,
          }),
        )
        setWeights(newWeights)
      } else {
        const errorData = await response.json().catch(() => ({}))
        setError(errorData.message || "Failed to load weights from holdings")
      }
    } catch (err) {
      console.error("Failed to load weights from holdings:", err)
      setError("Failed to load weights from holdings")
    } finally {
      setLoadingWeights(false)
    }
  }

  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0)

  const handleImport = (): void => {
    onImport(weights)
    onClose()
  }

  if (!modalOpen) return null

  return (
    <Dialog
      title={"Import from Holdings"}
      onClose={onClose}
      maxWidth="2xl"
      scrollable={true}
      footer={
        <>
          <Dialog.CancelButton onClick={onClose} label={"Cancel"} />
          <Dialog.SubmitButton
            onClick={handleImport}
            label={"Import"}
            disabled={weights.length === 0}
            variant="blue"
          />
        </>
      }
    >
      {/* Portfolio Selector */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {"Select Portfolio"}
        </label>
        <select
          value={selectedPortfolioId}
          onChange={(e) => handlePortfolioSelect(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">{"Choose a portfolio..."}</option>
          {portfolios.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} - {p.name}
            </option>
          ))}
        </select>
      </div>

      <Dialog.ErrorAlert message={error} />

      {loadingWeights && (
        <div className="flex items-center justify-center py-8">
          <Spinner size="xl" className="text-gray-400" label="Loading..." />
        </div>
      )}

      {selectedPortfolioId && !loadingWeights && !error && (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2 text-blue-700">
              <i className="fas fa-info-circle"></i>
              <span className="text-sm">
                {
                  "Weights are calculated from current market values. Adjust as needed before importing."
                }
              </span>
            </div>
          </div>

          <HoldingWeightsEditor
            weights={weights}
            totalWeight={totalWeight}
            onChange={setWeights}
            headerClassName="flex items-center justify-between mb-2"
          />

          {weights.length > 0 && (
            <div className="mt-4">
              <WeightsSummary
                totalWeight={totalWeight}
                assetCount={weights.length}
              />
            </div>
          )}
        </>
      )}

      {!selectedPortfolioId && !loadingWeights && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-500">
          {"Select a portfolio to view its holdings"}
        </div>
      )}
    </Dialog>
  )
}

export default ImportHoldingsDialog
