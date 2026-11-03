import React from "react"
import Link from "next/link"
import { Portfolio } from "types/beancounter"

const ICON_BUTTON_CLS =
  "inline-flex items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-wealth-500"

interface PortfolioRowActionsProps {
  portfolio: Portfolio
  canUseAi: boolean
  /** Touch cards need a 40px target; table rows stay compact. */
  size: "touch" | "compact"
  onReview: (portfolio: Portfolio) => void
  onShare: (portfolioId: string) => void
  onCorporateActions: (portfolio: Portfolio) => void
  onDelete: (target: { id: string; code: string }) => void
}

/** Per-portfolio actions, shared by the mobile card and the table row. */
export default function PortfolioRowActions({
  portfolio,
  canUseAi,
  size,
  onReview,
  onShare,
  onCorporateActions,
  onDelete,
}: PortfolioRowActionsProps): React.ReactElement {
  const buttonCls = `${ICON_BUTTON_CLS} ${size === "touch" ? "h-10 w-10" : "h-8 w-8"}`
  const { code } = portfolio

  return (
    <div className="action-buttons flex items-center justify-end">
      {canUseAi && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onReview(portfolio)
          }}
          className={`${buttonCls} hover:text-purple-600`}
          title={"AI Summary"}
          aria-label={"AI Summary"}
        >
          <i className="fas fa-wand-magic-sparkles text-sm"></i>
        </button>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onShare(portfolio.id)
        }}
        className={`${buttonCls} hover:text-wealth-600`}
        title={"Share"}
        aria-label={`Share ${code}`}
      >
        <i className="fas fa-share-alt text-sm"></i>
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onCorporateActions(portfolio)
        }}
        className={`${buttonCls} hover:text-wealth-600`}
        title={"Scan Corporate Actions"}
        aria-label={`Scan corporate actions for ${code}`}
      >
        <i className="fas fa-calendar-check text-sm"></i>
      </button>
      <Link
        href={`/portfolios/${portfolio.id}`}
        className={`${buttonCls} hover:text-wealth-600`}
        title={"Edit Portfolio"}
        aria-label={`Edit ${code}`}
        onClick={(e) => e.stopPropagation()}
      >
        <i className="fas fa-edit text-sm"></i>
      </Link>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onDelete({ id: portfolio.id, code })
        }}
        className={`${buttonCls} hover:text-loss`}
        title={"Delete Portfolio"}
        aria-label={`Delete ${code}`}
      >
        <i className="fas fa-trash-alt text-sm"></i>
      </button>
    </div>
  )
}
