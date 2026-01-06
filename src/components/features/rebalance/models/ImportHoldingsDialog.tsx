import React, { useState, useEffect } from "react"
import { useTranslation } from "next-i18next"
import useSWR from "swr"
import { fetcher, portfoliosKey } from "@utils/api/fetchHelper"
import WeightsSummary from "../common/WeightsSummary"
import { AssetWeightWithDetails } from "types/rebalance"
import { Portfolio } from "types/beancounter"

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
  const { t } = useTranslation("common")
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

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!modalOpen) {
      setSelectedPortfolioId("")
      setWeights([])
      setError(null)
    }
  }, [modalOpen])

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
      const valueCurrency = portfolio?.currency?.code || "USD"

      const response = await fetch(
        `/api/rebalance/models/${modelId}/plans/weights-from-holdings?portfolioId=${portfolioId}&valueCurrency=${valueCurrency}`,
      )

      if (response.ok) {
        const result: { data: HoldingWeightDto[] } = await response.json()
        const newWeights: AssetWeightWithDetails[] = result.data.map(
          (w, index) => ({
            assetId: w.assetId,
            assetCode: w.assetCode,
            assetName: w.assetName || undefined,
            weight: Math.round(w.weight * 10000) / 100, // Convert from decimal to percentage
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

  const handleNormalize = (): void => {
    if (totalWeight === 0) return
    const factor = 100 / totalWeight
    const normalized = weights.map((w) => ({
      ...w,
      weight: Math.round(w.weight * factor * 100) / 100,
    }))
    setWeights(normalized)
  }

  const handleImport = (): void => {
    onImport(weights)
    onClose()
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
            {t("rebalance.plans.importFromHoldings", "Import from Holdings")}
          </h2>
          <button
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            onClick={onClose}
          >
            &times;
          </button>
        </header>

        <div className="p-4 overflow-y-auto flex-1">
          {/* Portfolio Selector */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t("rebalance.plans.selectPortfolio", "Select Portfolio")}
            </label>
            <select
              value={selectedPortfolioId}
              onChange={(e) => handlePortfolioSelect(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">
                {t("rebalance.plans.choosePortfolio", "Choose a portfolio...")}
              </option>
              {portfolios.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} - {p.name}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-red-700">
              {error}
            </div>
          )}

          {loadingWeights && (
            <div className="flex items-center justify-center py-8">
              <i className="fas fa-spinner fa-spin text-gray-400 text-xl mr-2"></i>
              <span className="text-gray-500">
                {t("loading", "Loading...")}
              </span>
            </div>
          )}

          {selectedPortfolioId && !loadingWeights && !error && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <div className="flex items-center gap-2 text-blue-700">
                  <i className="fas fa-info-circle"></i>
                  <span className="text-sm">
                    {t(
                      "rebalance.plans.importHoldingsInfo",
                      "Weights are calculated from current market values. Adjust as needed before importing.",
                    )}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between mb-2">
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
                              weight: Math.round(value * 100) / 100,
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
              {t(
                "rebalance.plans.selectPortfolioPrompt",
                "Select a portfolio to view its holdings",
              )}
            </div>
          )}
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
              weights.length > 0
                ? "bg-blue-500 hover:bg-blue-600"
                : "bg-gray-400 cursor-not-allowed"
            }`}
            onClick={handleImport}
            disabled={weights.length === 0}
          >
            {t("import", "Import")}
          </button>
        </footer>
      </div>
    </div>
  )
}

export default ImportHoldingsDialog
