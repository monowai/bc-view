import React from "react"
import Link from "next/link"
import Dialog from "@components/ui/Dialog"
import { PortfolioWeight } from "@lib/holdings/aggregatedActions"

interface AggregatedPortfoliosPopupProps {
  weights: PortfolioWeight[]
  onClose: () => void
}

const AggregatedPortfoliosPopup: React.FC<AggregatedPortfoliosPopupProps> = ({
  weights,
  onClose,
}) => (
  <Dialog
    title="Portfolios in this view"
    onClose={onClose}
    maxWidth="md"
    scrollable
  >
    <ul className="divide-y divide-gray-100">
      {weights.map((row) => (
        <li key={row.portfolioId}>
          <Link
            href={`/holdings/${row.portfolioCode}`}
            onClick={onClose}
            className="flex items-center justify-between gap-3 px-2 py-3 rounded-md hover:bg-slate-50 focus:bg-slate-100 focus:outline-none"
          >
            <span className="min-w-0">
              <span className="block font-semibold text-gray-900">
                {row.portfolioCode}
              </span>
              <span className="block text-sm text-gray-500 truncate">
                {row.portfolioName}
              </span>
            </span>
            <span className="font-medium text-gray-900 tabular-nums shrink-0">
              {row.weight.toFixed(1)}%
            </span>
          </Link>
        </li>
      ))}
    </ul>
  </Dialog>
)

export default AggregatedPortfoliosPopup
