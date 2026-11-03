import React from "react"
import Link from "next/link"

interface QuickActionCardsProps {
  // In zen mode the Aggregated Holdings card is redundant (a single
  // portfolio's holdings == the aggregate), so swap it for a Pay Slip action.
  zenMode?: boolean
  onPayslip?: () => void
}

const ACTION_CLS =
  "flex items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-wealth-500"

const ActionLabel: React.FC<{
  icon: string
  title: string
  detail: string
}> = ({ icon, title, detail }) => (
  <>
    <i className={`fas ${icon} w-5 text-center text-gray-400`}></i>
    <span>
      <span className="block text-sm font-semibold text-gray-900">{title}</span>
      <span className="block text-sm text-gray-500">{detail}</span>
    </span>
  </>
)

const QuickActionCards: React.FC<QuickActionCardsProps> = ({
  zenMode = false,
  onPayslip,
}) => (
  <div className="grid grid-cols-1 divide-y divide-gray-100 overflow-hidden rounded-lg border border-gray-200 bg-white md:grid-cols-3 md:divide-x md:divide-y-0">
    {zenMode ? (
      <button type="button" onClick={onPayslip} className={ACTION_CLS}>
        <ActionLabel
          icon="fa-file-invoice-dollar"
          title="Pay Slip"
          detail="Record salary & contributions"
        />
      </button>
    ) : (
      <Link href="/holdings/aggregated" className={ACTION_CLS}>
        <ActionLabel
          icon="fa-layer-group"
          title="Aggregated Holdings"
          detail="View all holdings combined"
        />
      </Link>
    )}
    <Link href="/rebalance/wizard" className={ACTION_CLS}>
      <ActionLabel
        icon="fa-balance-scale"
        title="Rebalance"
        detail="Align to target allocations"
      />
    </Link>
    <Link href="/accounts" className={ACTION_CLS}>
      <ActionLabel
        icon="fa-gem"
        title="Custom Assets"
        detail="Property, accounts & more"
      />
    </Link>
  </div>
)

export default QuickActionCards
