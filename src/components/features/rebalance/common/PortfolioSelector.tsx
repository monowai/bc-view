import React, { useState } from "react"
import { useTranslation } from "next-i18next"
import useSwr from "swr"
import { portfoliosKey, simpleFetcher } from "@utils/api/fetchHelper"
import { PortfolioResponses, Portfolio } from "types/beancounter"

interface PortfolioSelectorProps {
  onSelect: (portfolioCodes: string[]) => void
  onCancel: () => void
  loading?: boolean
  multiSelect?: boolean
}

const PortfolioSelector: React.FC<PortfolioSelectorProps> = ({
  onSelect,
  onCancel,
  loading = false,
  multiSelect = true,
}) => {
  const { t } = useTranslation("common")
  const [selectedCodes, setSelectedCodes] = useState<string[]>([])

  const { data, isLoading, error } = useSwr<PortfolioResponses>(
    portfoliosKey,
    simpleFetcher(portfoliosKey),
  )

  const portfolios: Portfolio[] = data?.data || []

  const handleToggle = (portfolioCode: string): void => {
    if (multiSelect) {
      setSelectedCodes((prev) =>
        prev.includes(portfolioCode)
          ? prev.filter((code) => code !== portfolioCode)
          : [...prev, portfolioCode],
      )
    } else {
      setSelectedCodes([portfolioCode])
    }
  }

  const handleSelectAll = (): void => {
    if (selectedCodes.length === portfolios.length) {
      setSelectedCodes([])
    } else {
      setSelectedCodes(portfolios.map((p: Portfolio) => p.code))
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <i className="fas fa-spinner fa-spin text-gray-400 text-xl"></i>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {t("portfolios.error", "Failed to load portfolios")}
      </div>
    )
  }

  if (portfolios.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <p className="text-gray-600">
          {t("portfolios.empty", "No portfolios found")}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {multiSelect && portfolios.length > 1 && (
        <div className="flex items-center justify-between pb-2 border-b">
          <button
            type="button"
            onClick={handleSelectAll}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {selectedCodes.length === portfolios.length
              ? t("deselectAll", "Deselect All")
              : t("selectAll", "Select All")}
          </button>
          <span className="text-sm text-gray-500">
            {t("selected", "{{count}} selected", { count: selectedCodes.length })}
          </span>
        </div>
      )}

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {portfolios.map((portfolio) => (
          <label
            key={portfolio.id}
            className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
              selectedCodes.includes(portfolio.code)
                ? "border-violet-300 bg-violet-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <input
              type={multiSelect ? "checkbox" : "radio"}
              checked={selectedCodes.includes(portfolio.code)}
              onChange={() => handleToggle(portfolio.code)}
              className="w-4 h-4 text-violet-600 mr-3"
            />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900">{portfolio.name}</div>
              <div className="text-sm text-gray-500">{portfolio.code}</div>
            </div>
            <div className="text-sm text-gray-500 ml-2">
              {portfolio.currency.code}
            </div>
          </label>
        ))}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
        >
          {t("cancel", "Cancel")}
        </button>
        <button
          type="button"
          onClick={() => onSelect(selectedCodes)}
          disabled={selectedCodes.length === 0 || loading}
          className={`px-4 py-2 rounded text-white transition-colors flex items-center gap-2 ${
            selectedCodes.length > 0 && !loading
              ? "bg-violet-600 hover:bg-violet-700"
              : "bg-gray-400 cursor-not-allowed"
          }`}
        >
          {loading && <i className="fas fa-spinner fa-spin"></i>}
          {t("rebalance.models.useWeights", "Use Weights")}
        </button>
      </div>
    </div>
  )
}

export default PortfolioSelector
