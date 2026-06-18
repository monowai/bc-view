import React from "react"
import { useRouter } from "next/router"
import { Asset, PortfolioBreakdown } from "types/beancounter"
import Dialog from "@components/ui/Dialog"
import { PrivateQuantity } from "@components/ui/MoneyUtils"
import { stripOwnerPrefix } from "@lib/assets/assetUtils"

interface PortfolioBreakdownPopupProps {
  /** Used for the default "Held by — CODE" title; omit when `title` is set. */
  asset?: Asset
  breakdown: PortfolioBreakdown[]
  onClose: () => void
  /**
   * When provided, picking a portfolio calls this instead of navigating to its
   * holdings — used by the aggregated actions to choose which portfolio to act
   * on. Default behaviour (no handler) navigates to the portfolio.
   */
  onSelect?: (row: PortfolioBreakdown) => void
  /** Overrides the default "Held by — CODE" dialog title. */
  title?: string
}

const PortfolioBreakdownPopup: React.FC<PortfolioBreakdownPopupProps> = ({
  asset,
  breakdown,
  onClose,
  onSelect,
  title,
}) => {
  const router = useRouter()

  const handleSelect = (row: PortfolioBreakdown): void => {
    onClose()
    if (onSelect) {
      onSelect(row)
    } else {
      router.push(`/holdings/${row.portfolioCode}`)
    }
  }

  const sorted = [...breakdown].sort((a, b) => b.quantity - a.quantity)

  return (
    <Dialog
      title={title ?? `Held by — ${asset ? stripOwnerPrefix(asset.code) : ""}`}
      onClose={onClose}
      maxWidth="md"
      scrollable
    >
      <ul className="divide-y divide-gray-100">
        {sorted.map((row) => (
          <li key={row.portfolioId}>
            <button
              type="button"
              className="w-full flex items-center justify-between gap-3 px-2 py-3 text-left rounded-md hover:bg-slate-50 focus:bg-slate-100 focus:outline-none"
              onClick={() => handleSelect(row)}
              aria-label={`Open ${row.portfolioCode} holdings`}
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
                <PrivateQuantity value={row.quantity} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  )
}

export default PortfolioBreakdownPopup
