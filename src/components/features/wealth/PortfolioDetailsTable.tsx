import React from "react"
import Link from "next/link"
import { useTranslation } from "next-i18next"
import { useRouter } from "next/router"
import { Currency } from "types/beancounter"
import { FormatValue } from "@components/ui/MoneyUtils"
import { WealthSummary, COLORS } from "@lib/wealth/liquidityGroups"

type SortConfig = {
  key: string | null
  direction: "asc" | "desc"
}

interface PortfolioDetailsTableProps {
  summary: WealthSummary
  sortConfig: SortConfig
  onSort: (key: string) => void
  displayCurrency: Currency | null
  collapsed: boolean
  onToggle: () => void
}

const PortfolioDetailsTable: React.FC<PortfolioDetailsTableProps> = ({
  summary,
  sortConfig,
  onSort,
  displayCurrency,
  collapsed,
  onToggle,
}) => {
  const { t } = useTranslation("common")
  const router = useRouter()

  const getSortIcon = (headerKey: string): React.ReactElement => {
    if (sortConfig.key !== headerKey) {
      return <span className="ml-1 text-gray-400">&#8597;</span>
    }
    return sortConfig.direction === "asc" ? (
      <span className="ml-1 text-blue-500">&#8593;</span>
    ) : (
      <span className="ml-1 text-blue-500">&#8595;</span>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center text-lg font-semibold text-gray-900 hover:text-gray-700"
        >
          <i
            className={`fas fa-chevron-${collapsed ? "right" : "down"} text-gray-400 mr-2 w-4`}
          ></i>
          <i className="fas fa-table text-gray-400 mr-2"></i>
          Portfolio Details
        </button>
      </div>

      {!collapsed && (
        <>
          {summary.portfolioBreakdown.length === 0 ? (
            <div className="p-8">
              <p className="text-gray-600 mb-6 text-center">
                {t("portfolios.empty.title", "No portfolios yet")}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl mx-auto">
                {/* Guided Setup */}
                <Link
                  href="/onboarding"
                  className="border border-gray-200 rounded-lg p-4 text-center hover:border-blue-300 hover:shadow-sm transition-all"
                >
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <i className="fas fa-rocket text-blue-500"></i>
                  </div>
                  <h4 className="font-medium text-gray-900 mb-1">
                    {t("home.startSetup", "Start Setup")}
                  </h4>
                  <p className="text-gray-500 text-xs">
                    {t("portfolios.guided", "Guided setup")}
                  </p>
                </Link>
                {/* Direct Add */}
                <Link
                  href="/portfolios/__NEW__"
                  className="border border-gray-200 rounded-lg p-4 text-center hover:border-green-300 hover:shadow-sm transition-all"
                >
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <i className="fas fa-plus text-green-500"></i>
                  </div>
                  <h4 className="font-medium text-gray-900 mb-1">
                    {t("portfolio.create")}
                  </h4>
                  <p className="text-gray-500 text-xs">
                    {t("portfolios.direct", "Direct control")}
                  </p>
                </Link>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => onSort("code")}
                    >
                      <div className="flex items-center">
                        Portfolio
                        {getSortIcon("code")}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => onSort("value")}
                    >
                      <div className="flex items-center justify-end">
                        Value ({displayCurrency?.code})
                        {getSortIcon("value")}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => onSort("percentage")}
                    >
                      <div className="flex items-center justify-end">
                        % of Total
                        {getSortIcon("percentage")}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={() => onSort("irr")}
                    >
                      <div className="flex items-center justify-end">
                        IRR
                        {getSortIcon("irr")}
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {summary.portfolioBreakdown.map((portfolio, index) => (
                    <tr
                      key={portfolio.code}
                      className="hover:bg-slate-100 transition-colors cursor-pointer"
                      onClick={() =>
                        router.push(`/holdings/${portfolio.code}`)
                      }
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div
                            className="w-3 h-3 rounded-full mr-3"
                            style={{
                              backgroundColor:
                                COLORS[index % COLORS.length],
                            }}
                          ></div>
                          <div>
                            <Link
                              href={`/holdings/${portfolio.code}`}
                              className="font-medium text-blue-600 hover:text-blue-800"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {portfolio.code}
                            </Link>
                            <p className="text-sm text-gray-500">
                              {portfolio.name}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-gray-900">
                        {displayCurrency?.symbol}
                        <FormatValue value={portfolio.value} />
                      </td>
                      <td className="px-6 py-4 text-right text-gray-600">
                        {portfolio.percentage.toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span
                          className={`font-medium ${portfolio.irr >= 0 ? "text-green-600" : "text-red-600"}`}
                        >
                          {(portfolio.irr * 100).toFixed(2)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                  <tr>
                    <td className="px-6 py-4 font-bold text-gray-900">
                      Total
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-gray-900">
                      {displayCurrency?.symbol}
                      <FormatValue value={summary.totalValue} />
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-gray-600">
                      100%
                    </td>
                    <td className="px-6 py-4"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default PortfolioDetailsTable
