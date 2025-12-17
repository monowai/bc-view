import React from "react"
import { Holdings, Portfolio } from "types/beancounter"
import SummaryHeader, {
  SummaryHeaderMobile,
  SummaryRow,
  SummaryRowMobile,
} from "./Summary"
import { ViewMode } from "./ViewToggle"

interface HoldingsHeaderProps {
  portfolio: Portfolio
  holdings: Holdings
  viewMode: ViewMode
  onViewModeChange: (mode: ViewMode) => void
  /** If true, only renders mobile header (used in summary view) */
  mobileOnly?: boolean
}

/**
 * Shared header component for holdings pages.
 * Renders the appropriate header layout based on screen size and view mode.
 */
const HoldingsHeader: React.FC<HoldingsHeaderProps> = ({
  portfolio,
  holdings,
  viewMode,
  onViewModeChange,
  mobileOnly = false,
}) => {
  const portfolioSummary = {
    totals: holdings.totals,
    currency: holdings.currency,
  }

  return (
    <div>
      <SummaryHeaderMobile
        portfolio={portfolio}
        portfolioSummary={portfolioSummary}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
      />
      {!mobileOnly && (
        <>
          <SummaryRowMobile
            totals={holdings.totals}
            currency={holdings.currency}
          />
          <table className="min-w-full bg-white">
            <SummaryHeader
              portfolio={portfolio}
              portfolioSummary={portfolioSummary}
            />
            <SummaryRow />
          </table>
        </>
      )}
    </div>
  )
}

export default HoldingsHeader
