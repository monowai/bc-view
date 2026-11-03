import React from "react"
import Link from "next/link"
import { useRouter } from "next/router"
import { Currency } from "types/beancounter"
import { FormatValue } from "@components/ui/MoneyUtils"
import { WealthSummary } from "@lib/wealth/liquidityGroups"
import { getSortIcon, SortConfig } from "@lib/sortIcon"
import { gainLossClass } from "@lib/formatters"
import WealthSection from "@components/features/wealth/WealthSection"

const ARIA_SORT = { asc: "ascending", desc: "descending" } as const

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
  const router = useRouter()

  const columns = [
    { key: "code", label: "Portfolio", align: "left" },
    {
      key: "value",
      label: `Value (${displayCurrency?.code ?? ""})`,
      align: "right",
    },
    { key: "percentage", label: "% of Total", align: "right" },
    { key: "irr", label: "IRR", align: "right" },
  ]

  return (
    <WealthSection
      title="Portfolio Details"
      icon="fa-table"
      collapsed={collapsed}
      onToggle={onToggle}
      flush
    >
      {summary.portfolioBreakdown.length === 0 ? (
        <div className="p-8">
          <p className="text-gray-600 mb-6 text-center">
            {"No portfolios yet"}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl mx-auto">
            {/* Guided Setup */}
            <Link
              href="/onboarding"
              className="border border-gray-200 rounded-lg p-4 text-center hover:border-wealth-200 transition-colors"
            >
              <div className="w-10 h-10 bg-wealth-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="fas fa-rocket text-wealth-500"></i>
              </div>
              <h4 className="font-medium text-gray-900 mb-1">
                {"Start Setup"}
              </h4>
              <p className="text-gray-500 text-xs">{"Guided setup"}</p>
            </Link>
            {/* Direct Add */}
            <Link
              href="/portfolios/__NEW__"
              className="border border-gray-200 rounded-lg p-4 text-center hover:border-wealth-200 transition-colors"
            >
              <div className="w-10 h-10 bg-wealth-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <i className="fas fa-plus text-wealth-500"></i>
              </div>
              <h4 className="font-medium text-gray-900 mb-1">{"Add"}</h4>
              <p className="text-gray-500 text-xs">{"Direct control"}</p>
            </Link>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-y border-gray-100">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={
                      sortConfig.key === column.key
                        ? ARIA_SORT[sortConfig.direction]
                        : "none"
                    }
                    className="px-5 py-2.5 hover:bg-gray-50"
                  >
                    <button
                      type="button"
                      onClick={() => onSort(column.key)}
                      className={`flex w-full items-center ${column.align === "right" ? "justify-end" : "justify-start"} rounded-sm text-xs font-medium tracking-wide text-gray-500 hover:text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-wealth-500`}
                    >
                      {column.label}
                      {getSortIcon(column.key, sortConfig)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {summary.portfolioBreakdown.map((portfolio) => (
                <tr
                  key={portfolio.code}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => router.push(`/holdings/${portfolio.code}`)}
                >
                  <td className="px-5 py-2.5">
                    <Link
                      href={`/holdings/${portfolio.code}`}
                      className="rounded-sm text-sm font-semibold text-wealth-600 hover:underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-wealth-500"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {portfolio.code}
                    </Link>
                    <p className="text-sm text-gray-500">{portfolio.name}</p>
                  </td>
                  <td className="px-5 py-2.5 text-right text-sm font-medium tabular-nums text-gray-900">
                    {displayCurrency?.symbol}
                    <FormatValue value={portfolio.value} />
                  </td>
                  <td className="px-5 py-2.5 text-right text-sm tabular-nums text-gray-600">
                    {portfolio.percentage.toFixed(1)}%
                  </td>
                  <td className="px-5 py-2.5 text-right text-sm">
                    <span
                      className={`font-medium tabular-nums ${gainLossClass(portfolio.irr)}`}
                    >
                      {portfolio.irr > 0 ? "+" : ""}
                      {(portfolio.irr * 100).toFixed(2)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-gray-200 bg-gray-50">
              <tr>
                <td className="px-5 py-2.5 text-sm font-medium text-gray-500">
                  Total
                </td>
                <td className="px-5 py-2.5 text-right text-sm font-semibold tabular-nums text-gray-900">
                  {displayCurrency?.symbol}
                  <FormatValue value={summary.totalValue} />
                </td>
                <td className="px-5 py-2.5 text-right text-sm tabular-nums text-gray-600">
                  100%
                </td>
                <td className="px-5 py-2.5"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </WealthSection>
  )
}

export default PortfolioDetailsTable
