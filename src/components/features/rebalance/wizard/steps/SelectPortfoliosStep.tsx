import React, { useEffect } from "react"
import { useTranslation } from "next-i18next"
import useSwr from "swr"
import { portfoliosKey, simpleFetcher } from "@utils/api/fetchHelper"
import { PortfolioResponses } from "types/beancounter"
import { TableSkeletonLoader } from "@components/ui/SkeletonLoader"
import { FormatValue } from "@components/ui/MoneyUtils"

interface SelectPortfoliosStepProps {
  selectedPortfolioIds: string[]
  onChange: (portfolioIds: string[]) => void
  preselectedIds?: string[]
}

const SelectPortfoliosStep: React.FC<SelectPortfoliosStepProps> = ({
  selectedPortfolioIds,
  onChange,
  preselectedIds,
}) => {
  const { t } = useTranslation("common")
  const { data, error, isLoading } = useSwr<PortfolioResponses>(
    portfoliosKey,
    simpleFetcher(portfoliosKey),
  )

  // Preselect portfolios if provided
  useEffect(() => {
    if (
      preselectedIds &&
      preselectedIds.length > 0 &&
      selectedPortfolioIds.length === 0
    ) {
      onChange(preselectedIds)
    }
  }, [preselectedIds, selectedPortfolioIds.length, onChange])

  const handleToggle = (portfolioId: string): void => {
    if (selectedPortfolioIds.includes(portfolioId)) {
      onChange(selectedPortfolioIds.filter((id) => id !== portfolioId))
    } else {
      onChange([...selectedPortfolioIds, portfolioId])
    }
  }

  const handleSelectAll = (): void => {
    if (data?.data) {
      onChange(data.data.map((p) => p.id))
    }
  }

  const handleSelectNone = (): void => {
    onChange([])
  }

  if (isLoading) {
    return <TableSkeletonLoader rows={3} />
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {t("portfolios.error.retrieve", "Failed to load portfolios")}
      </div>
    )
  }

  const portfolios = data?.data || []

  if (portfolios.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <p className="text-gray-600">
          {t("error.portfolios.empty", "No portfolios found")}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900">
          {t("rebalance.wizard.selectPortfolios", "Select Portfolios")}
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          {t(
            "rebalance.wizard.selectPortfoliosDesc",
            "Choose which portfolios to include in this rebalance plan.",
          )}
        </p>
      </div>

      {/* Select all / none */}
      <div className="flex gap-4 text-sm">
        <button
          type="button"
          onClick={handleSelectAll}
          className="text-blue-600 hover:text-blue-800"
        >
          {t("selectAll", "Select All")}
        </button>
        <button
          type="button"
          onClick={handleSelectNone}
          className="text-blue-600 hover:text-blue-800"
        >
          {t("selectNone", "Select None")}
        </button>
      </div>

      {/* Portfolio list */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 w-10"></th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                {t("portfolio.code", "Code")}
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                {t("portfolio.name", "Name")}
              </th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                {t("portfolio.marketvalue", "Market Value")}
              </th>
              <th className="px-4 py-3 text-center text-sm font-medium text-gray-700">
                {t("portfolio.currency.report", "Currency")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {portfolios.map((portfolio) => (
              <tr
                key={portfolio.id}
                onClick={() => handleToggle(portfolio.id)}
                className={`hover:bg-slate-100 transition-colors cursor-pointer ${
                  selectedPortfolioIds.includes(portfolio.id)
                    ? "bg-blue-50"
                    : ""
                }`}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedPortfolioIds.includes(portfolio.id)}
                    onChange={() => handleToggle(portfolio.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300"
                  />
                </td>
                <td className="px-4 py-3 font-medium text-blue-600">
                  {portfolio.code}
                </td>
                <td className="px-4 py-3 text-gray-900">{portfolio.name}</td>
                <td className="px-4 py-3 text-right">
                  {portfolio.currency.symbol}
                  <FormatValue value={portfolio.marketValue || 0} />
                </td>
                <td className="px-4 py-3 text-center text-gray-600">
                  {portfolio.currency.code}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Selection summary */}
      <div className="text-sm text-gray-600">
        {t(
          "rebalance.wizard.selectedPortfolios",
          "{{count}} portfolio(s) selected",
          { count: selectedPortfolioIds.length },
        )}
      </div>
    </div>
  )
}

export default SelectPortfoliosStep
