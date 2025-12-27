import React, { useState } from "react"
import useSwr from "swr"
import { useTranslation } from "next-i18next"
import { Asset, AssetHolding, SectorExposure } from "types/beancounter"
import { simpleFetcher } from "@utils/api/fetchHelper"

interface SectorWeightingsPopupProps {
  asset: Asset
  modalOpen: boolean
  onClose: () => void
}

type TabType = "sectors" | "holdings"

// Color palette for sector bars
const SECTOR_COLORS: Record<string, string> = {
  "Information Technology": "#3B82F6",
  "Health Care": "#10B981",
  Financials: "#8B5CF6",
  "Consumer Discretionary": "#F59E0B",
  "Communication Services": "#EC4899",
  Industrials: "#6366F1",
  "Consumer Staples": "#14B8A6",
  Energy: "#EF4444",
  Utilities: "#84CC16",
  "Real Estate": "#F97316",
  Materials: "#06B6D4",
}

const getBarColor = (sectorName: string, index: number): string => {
  const fallbackColors = [
    "#3B82F6",
    "#10B981",
    "#8B5CF6",
    "#F59E0B",
    "#EC4899",
    "#6366F1",
    "#14B8A6",
    "#EF4444",
  ]
  return (
    SECTOR_COLORS[sectorName] || fallbackColors[index % fallbackColors.length]
  )
}

const SectorWeightingsPopup: React.FC<SectorWeightingsPopupProps> = ({
  asset,
  modalOpen,
  onClose,
}) => {
  const { t } = useTranslation("common")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>("sectors")

  const exposuresKey = `/api/classifications/${asset.id}/exposures`
  const holdingsKey = `/api/classifications/${asset.id}/holdings`

  const {
    data: exposuresData,
    error: exposuresError,
    isLoading: exposuresLoading,
    mutate: mutateExposures,
  } = useSwr(
    modalOpen ? exposuresKey : null,
    modalOpen ? simpleFetcher(exposuresKey) : null,
  )

  const {
    data: holdingsData,
    error: holdingsError,
    isLoading: holdingsLoading,
    mutate: mutateHoldings,
  } = useSwr(
    modalOpen ? holdingsKey : null,
    modalOpen ? simpleFetcher(holdingsKey) : null,
  )

  const handleRefresh = async (): Promise<void> => {
    setIsRefreshing(true)
    setRefreshError(null)

    try {
      const response = await fetch(`/api/classifications/${asset.id}/refresh`, {
        method: "POST",
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        setRefreshError(
          errorData.message ||
            t("sector.weightings.refreshError", "Failed to load sector data"),
        )
        return
      }

      // Re-fetch both exposures and holdings data
      await Promise.all([mutateExposures(), mutateHoldings()])
    } catch (err) {
      setRefreshError(
        err instanceof Error
          ? err.message
          : t("sector.weightings.refreshError", "Failed to load sector data"),
      )
    } finally {
      setIsRefreshing(false)
    }
  }

  if (!modalOpen) {
    return null
  }

  // Sort exposures by weight descending
  const exposures: SectorExposure[] = (exposuresData?.data || [])
    .slice()
    .sort((a: SectorExposure, b: SectorExposure) => b.weight - a.weight)

  // Sort holdings by weight descending
  const holdings: AssetHolding[] = (holdingsData?.data || [])
    .slice()
    .sort((a: AssetHolding, b: AssetHolding) => b.weight - a.weight)

  // Find max weight for scaling bars
  const maxExposureWeight = exposures.length > 0 ? exposures[0].weight : 0
  const maxHoldingWeight = holdings.length > 0 ? holdings[0].weight : 0

  const isLoading = activeTab === "sectors" ? exposuresLoading : holdingsLoading
  const error = activeTab === "sectors" ? exposuresError : holdingsError
  const hasNoData =
    activeTab === "sectors"
      ? exposures.length === 0 && holdings.length === 0
      : holdings.length === 0 && exposures.length === 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black opacity-50"
        onClick={onClose}
      ></div>
      <div className="bg-white rounded-lg shadow-lg w-full max-w-lg mx-auto p-6 z-50 max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-semibold">
              {t("sector.weightings.title", "ETF Details")}
            </h2>
            <p className="text-sm text-gray-600">{asset.name}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b mb-4">
          <button
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === "sectors"
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setActiveTab("sectors")}
          >
            {t("sector.weightings.sectorsTab", "Sectors")}
          </button>
          <button
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === "holdings"
                ? "border-b-2 border-blue-500 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
            onClick={() => setActiveTab("holdings")}
          >
            {t("sector.weightings.holdingsTab", "Top Holdings")}
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <i className="fas fa-spinner fa-spin mr-2"></i>
              {t("loading")}
            </div>
          )}

          {error && (
            <div className="text-red-500 py-4">
              {t("sector.weightings.error", "Failed to load data")}
            </div>
          )}

          {!isLoading && !error && hasNoData && (
            <div className="py-8 text-center">
              <p className="text-gray-500 mb-4">
                {t(
                  "sector.weightings.noData",
                  "No data available for this asset",
                )}
              </p>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRefreshing ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    {t("sector.weightings.loading", "Loading...")}
                  </>
                ) : (
                  <>
                    <i className="fas fa-download mr-2"></i>
                    {t("sector.weightings.load", "Load Data")}
                  </>
                )}
              </button>
              {refreshError && (
                <p className="text-red-500 mt-2 text-sm">{refreshError}</p>
              )}
            </div>
          )}

          {/* Sectors Tab Content */}
          {activeTab === "sectors" &&
            !isLoading &&
            !error &&
            exposures.length > 0 && (
              <div className="space-y-3">
                {exposures.map((exposure, index) => {
                  const percentage = exposure.weight * 100
                  const barWidth =
                    maxExposureWeight > 0
                      ? (exposure.weight / maxExposureWeight) * 100
                      : 0
                  const barColor = getBarColor(exposure.item.name, index)

                  return (
                    <div key={exposure.item.code} className="flex items-center">
                      <div className="w-32 flex-shrink-0 text-sm text-gray-700 truncate pr-2">
                        {exposure.item.name}
                      </div>
                      <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden mr-3">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${barWidth}%`,
                            backgroundColor: barColor,
                          }}
                        />
                      </div>
                      <div className="w-16 text-right text-sm font-medium text-gray-900">
                        {percentage.toFixed(1)}%
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

          {/* Holdings Tab Content */}
          {activeTab === "holdings" &&
            !isLoading &&
            !error &&
            holdings.length > 0 && (
              <div className="space-y-3">
                {holdings.map((holding, index) => {
                  const percentage = holding.weight * 100
                  const barWidth =
                    maxHoldingWeight > 0
                      ? (holding.weight / maxHoldingWeight) * 100
                      : 0
                  const barColor = getBarColor(holding.symbol, index)

                  return (
                    <div key={holding.symbol} className="flex items-center">
                      <div className="w-32 flex-shrink-0 pr-2">
                        <div className="text-sm font-medium text-gray-900">
                          {holding.symbol}
                        </div>
                        {holding.name && (
                          <div className="text-xs text-gray-500 truncate">
                            {holding.name}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden mr-3">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${barWidth}%`,
                            backgroundColor: barColor,
                          }}
                        />
                      </div>
                      <div className="w-16 text-right text-sm font-medium text-gray-900">
                        {percentage.toFixed(1)}%
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

          {/* Show message when current tab has no data but other tab does */}
          {activeTab === "sectors" &&
            !isLoading &&
            !error &&
            exposures.length === 0 &&
            holdings.length > 0 && (
              <div className="py-8 text-center text-gray-500">
                {t(
                  "sector.weightings.noSectors",
                  "No sector data available. Check the Top Holdings tab.",
                )}
              </div>
            )}

          {activeTab === "holdings" &&
            !isLoading &&
            !error &&
            holdings.length === 0 &&
            exposures.length > 0 && (
              <div className="py-8 text-center text-gray-500">
                {t(
                  "sector.weightings.noHoldings",
                  "No holdings data available. Check the Sectors tab.",
                )}
              </div>
            )}
        </div>

        {!isLoading &&
          ((activeTab === "sectors" &&
            exposures.length > 0 &&
            exposures[0].asOf) ||
            (activeTab === "holdings" &&
              holdings.length > 0 &&
              holdings[0].asOf)) && (
            <div className="mt-4 pt-4 border-t text-xs text-gray-400 text-center">
              {t("sector.weightings.asOf", "Data as of")}:{" "}
              {activeTab === "sectors" ? exposures[0].asOf : holdings[0].asOf}
            </div>
          )}

        <div className="flex justify-end mt-4 pt-4 border-t">
          <button
            className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 transition-colors"
            onClick={onClose}
          >
            {t("close", "Close")}
          </button>
        </div>
      </div>
    </div>
  )
}

export default SectorWeightingsPopup
