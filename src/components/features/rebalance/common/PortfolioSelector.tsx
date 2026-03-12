import React, { useState } from "react"
import useSwr from "swr"
import { portfoliosKey, simpleFetcher } from "@utils/api/fetchHelper"
import { PortfolioResponses, Portfolio } from "types/beancounter"
import Spinner from "@components/ui/Spinner"

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
  const [selectedCodes, setSelectedCodes] = useState<string[]>([])

  const { data, isLoading, error } = useSwr<PortfolioResponses>(
    portfoliosKey,
    simpleFetcher(portfoliosKey),
  )

  // Sort inactive portfolios (zero balance) last
  const portfolios: Portfolio[] = [...(data?.data || [])].sort(
    (a: Portfolio, b: Portfolio) => {
      const aInactive = (a.marketValue || 0) === 0 ? 1 : 0
      const bInactive = (b.marketValue || 0) === 0 ? 1 : 0
      return aInactive - bInactive
    },
  )

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
        <Spinner size="xl" className="text-gray-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {"Failed to load portfolios"}
      </div>
    )
  }

  if (portfolios.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <p className="text-gray-600">{"No portfolios found"}</p>
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
              ? "Deselect All"
              : "Select All"}
          </button>
          <span className="text-sm text-gray-500">
            {selectedCodes.length} {"selected"}
          </span>
        </div>
      )}

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {portfolios.map((portfolio, index) => {
          const isInactive = (portfolio.marketValue || 0) === 0
          const prevPortfolio = index > 0 ? portfolios[index - 1] : null
          const showSeparator =
            isInactive &&
            prevPortfolio &&
            (prevPortfolio.marketValue || 0) !== 0
          return (
            <React.Fragment key={portfolio.id}>
              {showSeparator && (
                <div className="border-t border-gray-200 pt-2 mt-2">
                  <span className="text-xs text-gray-400 px-1">
                    {"Inactive"}
                  </span>
                </div>
              )}
              <label
                className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedCodes.includes(portfolio.code)
                    ? "border-violet-300 bg-violet-50"
                    : isInactive
                      ? "border-gray-100 hover:border-gray-200"
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
                  <div
                    className={`font-medium ${isInactive ? "text-gray-400" : "text-gray-900"}`}
                  >
                    {portfolio.name}
                  </div>
                  <div className="text-sm text-gray-500">{portfolio.code}</div>
                </div>
                <div className="text-sm text-gray-500 ml-2">
                  {portfolio.currency.code}
                </div>
              </label>
            </React.Fragment>
          )
        })}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
        >
          {"Cancel"}
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
          {"Use Weights"}
        </button>
      </div>
    </div>
  )
}

export default PortfolioSelector
