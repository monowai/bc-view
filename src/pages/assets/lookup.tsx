import React, { useState } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useRouter } from "next/router"
import useSWR from "swr"
import { marketsKey, simpleFetcher } from "@utils/api/fetchHelper"
import { useUserPreferences } from "@contexts/UserPreferencesContext"
import {
  Asset,
  AssetCategory,
  AssetOption,
  Market,
  Portfolio,
  Position,
} from "types/beancounter"
import { ModelsContainingAssetResponse } from "types/rebalance"
import AssetSearch from "@components/features/assets/AssetSearch"
import { useAssetReview } from "@components/features/assets/useAssetReview"
import PriceChartPopup from "@components/features/holdings/PriceChartPopup"
import Spinner from "@components/ui/Spinner"
import { usePermissions } from "@hooks/usePermissions"

interface AssetPosition {
  portfolio: Portfolio
  position: Position | null
  balance: number
}

function assetOptionToAsset(option: AssetOption): Asset {
  const marketCode = option.market || ""
  const category: AssetCategory = {
    id: option.type || "EQUITY",
    name: option.type || "EQUITY",
  }
  return {
    id: option.assetId || option.value,
    code: option.symbol,
    name: option.name || option.symbol,
    assetCategory: category,
    market: { code: marketCode } as Market,
  }
}

function AssetLookupPage(): React.ReactElement {
  const router = useRouter()
  const { preferences } = useUserPreferences()

  const [selectedAsset, setSelectedAsset] = useState<AssetOption | null>(null)
  const [selectedMarket, setSelectedMarket] = useState<string>(
    preferences?.defaultMarket || "",
  )
  const [chartAsset, setChartAsset] = useState<Asset | null>(null)
  const [resolvingChart, setResolvingChart] = useState(false)
  const [resolveError, setResolveError] = useState<string | null>(null)
  const { popup: reviewPopup, showReview } = useAssetReview()
  const { ai: canRunAi, preview: canPreview } = usePermissions()
  const canReviewAsset = canRunAi || canPreview

  // Fetch available markets
  const { data: marketsData } = useSWR<{ data: Market[] }>(
    marketsKey,
    simpleFetcher(marketsKey),
  )

  // Fetch positions when an asset is selected
  const { data: positionsData, isLoading: loadingPositions } = useSWR<{
    data: AssetPosition[]
  }>(
    selectedAsset?.assetId
      ? `/api/assets/${selectedAsset.assetId}/positions?date=today`
      : null,
    simpleFetcher(`/api/assets/${selectedAsset?.assetId}/positions?date=today`),
  )

  const positions = positionsData?.data || []

  // Fetch models with active plans containing this asset
  const { data: modelsData, isLoading: loadingModels } =
    useSWR<ModelsContainingAssetResponse>(
      selectedAsset?.assetId
        ? `/api/rebalance/assets/${selectedAsset.assetId}/models`
        : null,
      simpleFetcher(`/api/rebalance/assets/${selectedAsset?.assetId}/models`),
    )

  const models = modelsData?.data || []

  const knownMarkets = (marketsData?.data || []).map((m) => m.code)

  const handleAssetSelect = (option: AssetOption | null): void => {
    setSelectedAsset(option)
    setResolveError(null)
  }

  const openChartFor = async (option: AssetOption): Promise<void> => {
    setResolveError(null)
    if (option.assetId) {
      setChartAsset(assetOptionToAsset(option))
      return
    }
    if (!option.market || !option.symbol) {
      setResolveError("Cannot chart this asset — missing market or symbol")
      return
    }
    setResolvingChart(true)
    try {
      const code = option.symbol.toUpperCase()
      const response = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: {
            [code]: {
              market: option.market,
              code,
              name: option.name || code,
              currency: option.currency,
              category: option.type || "EQUITY",
              owner: "",
            },
          },
        }),
      })
      if (!response.ok) {
        setResolveError(`Could not resolve asset (${response.status})`)
        return
      }
      const body = (await response.json()) as { data: Record<string, Asset> }
      const created = body.data?.[code]
      if (!created?.id) {
        setResolveError("Asset response missing id")
        return
      }
      setSelectedAsset({ ...option, assetId: created.id })
      setChartAsset(created)
    } catch (e) {
      setResolveError(e instanceof Error ? e.message : "Failed to load chart")
    } finally {
      setResolvingChart(false)
    }
  }

  // Navigate to transactions on double-click
  const handleRowDoubleClick = (portfolioId: string, assetId: string): void => {
    router.push(`/trns/trades/${portfolioId}/${assetId}`)
  }

  // Format currency value
  const formatValue = (value: number, currency?: string): string => {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value)
  }

  // Format quantity
  const formatQuantity = (value: number): string => {
    return new Intl.NumberFormat(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    }).format(value)
  }

  // Format weight as percentage
  const formatWeight = (value: number): string => {
    return `${(value * 100).toFixed(2)}%`
  }

  return (
    <div className="container mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{"Asset Lookup"}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {"Search for an asset to see which portfolios hold it"}
        </p>
      </div>

      {/* Search Box */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg p-4 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {"Search Asset"}
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={selectedMarket}
            onChange={(e) => {
              setSelectedMarket(e.target.value)
              setSelectedAsset(null)
            }}
            className="w-full sm:w-auto border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">{"All Markets"}</option>
            {(marketsData?.data || []).map((market) => (
              <option key={market.code} value={market.code}>
                {market.code} — {market.name}
              </option>
            ))}
          </select>
          <div className="flex-1">
            <AssetSearch
              key={selectedMarket}
              market={selectedMarket}
              knownMarkets={knownMarkets}
              value={selectedAsset}
              onSelect={handleAssetSelect}
              noResultsHref="/assets/account"
              placeholder={"Type asset symbol or name..."}
            />
          </div>
        </div>
      </div>

      {/* Selected Asset Info */}
      {selectedAsset && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {selectedAsset.label}
              </h2>
              <div className="flex items-center gap-3 mt-1 text-sm text-gray-600">
                {selectedAsset.market && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                    {selectedAsset.market}
                  </span>
                )}
                {selectedAsset.currency && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                    {selectedAsset.currency}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedAsset.market && selectedAsset.symbol && (
                <button
                  type="button"
                  onClick={() => openChartFor(selectedAsset)}
                  disabled={resolvingChart}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed"
                  aria-label={`Show price chart for ${selectedAsset.symbol}`}
                  title="Price Chart"
                >
                  <i className="fas fa-chart-line"></i>
                  <span>{resolvingChart ? "Loading..." : "Chart"}</span>
                </button>
              )}
              {canReviewAsset && (
                <button
                  type="button"
                  onClick={() => showReview(selectedAsset)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-purple-600 text-white text-sm font-medium hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1"
                  aria-label={`Open AI Asset Review for ${selectedAsset.symbol}`}
                  title="AI Asset Review"
                >
                  <i className="fas fa-microscope"></i>
                  <span>AI Review</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {reviewPopup}
      {resolveError && (
        <div className="mb-4 px-4 py-2 rounded-md bg-red-50 border border-red-200 text-sm text-red-700">
          {resolveError}
        </div>
      )}
      {chartAsset && (
        <PriceChartPopup
          asset={chartAsset}
          currencySymbol=""
          onClose={() => setChartAsset(null)}
        />
      )}

      {/* Positions Table */}
      {selectedAsset && (
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-medium text-gray-700">
              <i className="fas fa-briefcase mr-2 text-gray-400"></i>
              {"Portfolios Holding This Asset"}
            </h3>
          </div>

          {loadingPositions ? (
            <div className="p-8 text-center text-gray-500">
              <Spinner className="mr-2" />
              {"Loading..."}
            </div>
          ) : positions.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <i className="fas fa-folder-open text-3xl mb-2 text-gray-300"></i>
              <p>{"This asset is not held in any portfolio"}</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {"Portfolio"}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {"Qty"}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                    {"Cost"}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {"Value"}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    {"Gain"}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {positions.map((ap) => {
                  const moneyValues = ap.position?.moneyValues?.PORTFOLIO
                  const gain = moneyValues
                    ? (moneyValues.marketValue || 0) -
                      (moneyValues.costValue || 0)
                    : 0
                  const gainPercent =
                    moneyValues && moneyValues.costValue
                      ? (gain / moneyValues.costValue) * 100
                      : 0

                  return (
                    <tr
                      key={ap.portfolio.id}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onDoubleClick={() =>
                        handleRowDoubleClick(
                          ap.portfolio.id,
                          selectedAsset.assetId || selectedAsset.value,
                        )
                      }
                      title={"Double-click to edit"}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">
                          {ap.portfolio.code}
                        </div>
                        <div className="text-xs text-gray-500">
                          {ap.portfolio.name}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900">
                        {formatQuantity(ap.balance)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 hidden sm:table-cell">
                        {moneyValues
                          ? formatValue(
                              moneyValues.costValue || 0,
                              ap.portfolio.currency.code,
                            )
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-900 font-medium">
                        {moneyValues
                          ? formatValue(
                              moneyValues.marketValue || 0,
                              ap.portfolio.currency.code,
                            )
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-right hidden md:table-cell">
                        {moneyValues ? (
                          <div
                            className={
                              gain >= 0 ? "text-green-600" : "text-red-600"
                            }
                          >
                            <div>
                              {formatValue(gain, ap.portfolio.currency.code)}
                            </div>
                            <div className="text-xs">
                              ({gainPercent >= 0 ? "+" : ""}
                              {gainPercent.toFixed(1)}%)
                            </div>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {positions.length > 0 && (
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
              <i className="fas fa-info-circle mr-1"></i>
              {"Double-click a row to view and edit transactions"}
            </div>
          )}
        </div>
      )}

      {/* Models Table */}
      {selectedAsset && (
        <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden mt-6">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-medium text-gray-700">
              <i className="fas fa-sitemap mr-2 text-gray-400"></i>
              {"Models With Active Plans"}
            </h3>
          </div>

          {loadingModels ? (
            <div className="p-8 text-center text-gray-500">
              <Spinner className="mr-2" />
              {"Loading..."}
            </div>
          ) : models.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <i className="fas fa-sitemap text-3xl mb-2 text-gray-300"></i>
              <p>{"This asset is not in any active model plans"}</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {"Model"}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {"Version"}
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {"Target Weight"}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {models.map((model) => (
                  <tr
                    key={`${model.modelId}-${model.planId}`}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onDoubleClick={() =>
                      router.push(
                        `/rebalance/models/${model.modelId}/plans/${model.planId}`,
                      )
                    }
                    title={"Double-click to view plan"}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">
                        {model.modelName}
                      </div>
                      {model.assetCode && (
                        <div className="text-xs text-gray-500">
                          {model.assetCode}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      v{model.planVersion}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 font-medium">
                      {formatWeight(model.targetWeight)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {models.length > 0 && (
            <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
              <i className="fas fa-info-circle mr-1"></i>
              {"Double-click a row to view the model plan"}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
export default withPageAuthRequired(AssetLookupPage)
