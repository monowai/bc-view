import React, { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useRouter } from "next/router"
import TradeInputForm from "@components/features/transactions/TradeInputForm"
import CashInputForm from "@components/features/transactions/CashInputForm"
import CopyPopup from "@components/ui/CopyPopup"
import { HoldingContract, Holdings, QuickSellData } from "types/beancounter"
import { ViewMode } from "./ViewToggle"
import { AllocationSlice } from "@lib/allocation/aggregateHoldings"
import { useIsAdmin } from "@hooks/useIsAdmin"
import {
  GroupBy,
  useGroupOptions,
} from "@components/features/holdings/GroupByOptions"
import { useHoldingState } from "@lib/holdings/holdingState"

// Dropdown Menu Component
interface DropdownMenuProps {
  label: string
  icon: string
  colorClass: string
  items: { label: string; icon: string; onClick: () => void }[]
  disabled?: boolean
}

const DropdownMenu: React.FC<DropdownMenuProps> = ({
  label,
  icon,
  colorClass,
  items,
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        className={`mobile-portrait:hidden w-full sm:w-auto ${colorClass} text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center justify-center gap-1.5 ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <i className={`fas ${icon} text-[10px]`}></i>
        <span>{label}</span>
        <i
          className={`fas fa-chevron-down text-[8px] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        ></i>
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-44 bg-white rounded-lg shadow-lg shadow-slate-200/50 border border-slate-200/80 z-50 overflow-hidden">
          {items.map((item, index) => (
            <button
              key={index}
              className="w-full text-left px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 hover:text-slate-900 flex items-center gap-2 transition-colors duration-150"
              onClick={() => {
                setIsOpen(false)
                item.onClick()
              }}
            >
              <i
                className={`fas ${item.icon} w-3.5 text-center text-slate-400`}
              ></i>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Summary columns available for copying
const SUMMARY_COLUMNS = [
  "Group",
  "Market Value",
  "Change",
  "IRR",
  "Alpha",
  "Weight",
] as const
type SummaryColumn = (typeof SUMMARY_COLUMNS)[number]

// Default columns for summary copy
const DEFAULT_SUMMARY_COLUMNS: SummaryColumn[] = ["Group", "IRR", "Weight"]

interface HoldingActionsProps {
  holdingResults: HoldingContract
  columns: string[]
  valueIn: string
  quickSellData?: QuickSellData
  onQuickSellHandled?: () => void
  emptyHoldings?: boolean
  viewMode?: ViewMode
  onViewModeChange?: (mode: ViewMode) => void
  allocationData?: AllocationSlice[]
  holdings?: Holdings | null
  /** Hide GroupBy controls */
  hideGroupBy?: boolean
  /** Callback to open share dialog for this portfolio */
  onShare?: () => void
  /** Callback to open the select plan dialog for rebalancing */
  onSelectPlan?: () => void
  /** Callback to open the invest cash dialog */
  onInvestCash?: () => void
}

/** View mode icon component */
const ViewModeIcon: React.FC<{ mode: string; className?: string }> = ({
  mode,
  className = "w-3.5 h-3.5",
}) => {
  switch (mode) {
    case "summary":
      return (
        <svg
          className={className}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      )
    case "cards":
      return (
        <svg
          className={className}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
          />
        </svg>
      )
    case "heatmap":
      return (
        <svg
          className={className}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
          />
        </svg>
      )
    case "income":
      return (
        <svg
          className={className}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      )
    case "table":
      return (
        <svg
          className={className}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 4h18M3 10h18M3 16h18"
          />
        </svg>
      )
    case "chart":
      return (
        <svg
          className={className}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
          />
        </svg>
      )
    default:
      return null
  }
}

/** GroupBy icon component */
const GroupByIcon: React.FC<{ groupBy: string; className?: string }> = ({
  groupBy,
  className = "w-3.5 h-3.5",
}) => {
  switch (groupBy) {
    case GroupBy.ASSET_CLASS:
      return (
        <svg
          className={className}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
          />
        </svg>
      )
    case GroupBy.SECTOR:
      return (
        <svg
          className={className}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"
          />
        </svg>
      )
    case GroupBy.MARKET_CURRENCY:
      return (
        <svg
          className={className}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      )
    case GroupBy.MARKET:
      return (
        <svg
          className={className}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      )
    default:
      return null
  }
}

const viewModes: { value: ViewMode; label: string }[] = [
  { value: "summary", label: "Summary" },
  { value: "cards", label: "Cards" },
  { value: "heatmap", label: "Heatmap" },
  { value: "income", label: "Income" },
  { value: "chart", label: "Growth" },
  { value: "table", label: "Table" },
]

const HoldingActions: React.FC<HoldingActionsProps> = ({
  holdingResults,
  columns,
  valueIn,
  quickSellData,
  onQuickSellHandled,
  emptyHoldings = false,
  viewMode = "table",
  onViewModeChange,
  allocationData = [],
  holdings,
  hideGroupBy = false,
  onShare,
  onSelectPlan,
  onInvestCash,
}) => {
  const router = useRouter()
  const { isAdmin } = useIsAdmin()
  const holdingState = useHoldingState()
  const groupOptions = useGroupOptions()
  const [tradeModalOpen, setTradeModalOpen] = useState(false)
  const [cashModalOpen, setCashModalOpen] = useState(false)

  // Open trade/cash modal via ?action= query parameter (used by mobile header)
  useEffect(() => {
    if (router.query.action === "trade") {
      setTradeModalOpen(true)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { action, ...rest } = router.query
      router.replace({ pathname: router.pathname, query: rest }, undefined, {
        shallow: true,
      })
    } else if (router.query.action === "cash") {
      setCashModalOpen(true)
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { action, ...rest } = router.query
      router.replace({ pathname: router.pathname, query: rest }, undefined, {
        shallow: true,
      })
    }
  }, [router.query.action]) // eslint-disable-line react-hooks/exhaustive-deps
  const [copyModalOpen, setCopyModalOpen] = useState(false)
  const [summaryCopyModalOpen, setSummaryCopyModalOpen] = useState(false)
  const [selectedSummaryColumns, setSelectedSummaryColumns] = useState<
    SummaryColumn[]
  >(DEFAULT_SUMMARY_COLUMNS)
  const [copied, setCopied] = useState(false)

  // Open trade modal when quick sell data is provided
  useEffect(() => {
    if (quickSellData) {
      setTradeModalOpen(true)
    }
  }, [quickSellData])

  // Handle trade modal close
  const handleTradeModalClose = (open: boolean): void => {
    setTradeModalOpen(open)
    if (!open && onQuickSellHandled) {
      onQuickSellHandled()
    }
  }

  // Toggle summary column selection
  const handleSummaryColumnChange = useCallback((column: SummaryColumn) => {
    setSelectedSummaryColumns((prev) =>
      prev.includes(column)
        ? prev.filter((col) => col !== column)
        : [...prev, column],
    )
  }, [])

  // Get value for a summary column
  const getSummaryColumnValue = useCallback(
    (column: SummaryColumn, slice: AllocationSlice, total: number): string => {
      const percentage = total > 0 ? (slice.value / total) * 100 : 0
      switch (column) {
        case "Group":
          return slice.label
        case "Market Value":
          return slice.value.toFixed(2)
        case "Change":
          return slice.gainOnDay.toFixed(2)
        case "IRR":
          return (slice.irr * 100).toFixed(2) + "%"
        case "Alpha":
          return (slice.irr * 100 - 7).toFixed(2) + "%" // Alpha = IRR - 7% benchmark
        case "Weight":
          return percentage.toFixed(1) + "%"
        default:
          return ""
      }
    },
    [],
  )

  // Get total row value for a summary column
  const getSummaryTotalValue = useCallback(
    (column: SummaryColumn, total: number, totalGainOnDay: number): string => {
      if (!holdings) return ""
      switch (column) {
        case "Group":
          return "Total"
        case "Market Value":
          return total.toFixed(2)
        case "Change":
          return totalGainOnDay.toFixed(2)
        case "IRR":
          return (holdings.totals.irr * 100).toFixed(2) + "%"
        case "Alpha":
          return "" // No alpha for total
        case "Weight":
          return "100%"
        default:
          return ""
      }
    },
    [holdings],
  )

  // Copy summary/allocation data to clipboard with selected columns
  const handleCopySummary = useCallback(() => {
    if (!holdings || allocationData.length === 0) return
    if (selectedSummaryColumns.length === 0) return

    const total = allocationData.reduce((sum, slice) => sum + slice.value, 0)
    const totalGainOnDay = allocationData.reduce(
      (sum, slice) => sum + slice.gainOnDay,
      0,
    )

    const headers = selectedSummaryColumns.join("\t")
    const rows = allocationData.map((slice) =>
      selectedSummaryColumns
        .map((col) => getSummaryColumnValue(col, slice, total))
        .join("\t"),
    )
    const totalRow = selectedSummaryColumns
      .map((col) => getSummaryTotalValue(col, total, totalGainOnDay))
      .join("\t")

    const clipboardData = [headers, ...rows, totalRow].join("\n")

    navigator.clipboard.writeText(clipboardData).then(() => {
      setCopied(true)
      setSummaryCopyModalOpen(false)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [
    allocationData,
    holdings,
    selectedSummaryColumns,
    getSummaryColumnValue,
    getSummaryTotalValue,
  ])

  // Handle copy button click based on view mode
  const handleCopyClick = (): void => {
    if (viewMode === "summary") {
      setSummaryCopyModalOpen(true)
    } else {
      setCopyModalOpen(true)
    }
  }

  // Get button text based on view mode
  const getCopyButtonText = (): string => {
    if (copied) return "Copied!"
    return viewMode === "summary" ? "Copy Summary" : "Copy Holdings"
  }

  // Trade dropdown items
  const tradeItems = [
    {
      label: "Asset Trade",
      icon: "fa-chart-line",
      onClick: () => setTradeModalOpen(true),
    },
    {
      label: "Cash Transaction",
      icon: "fa-dollar-sign",
      onClick: () => setCashModalOpen(true),
    },
    {
      label: "Review Proposed",
      icon: "fa-clipboard-list",
      onClick: () =>
        router.push(
          `/trns/proposed?portfolioId=${holdingResults.portfolio.id}`,
        ),
    },
  ]

  // Rebalance dropdown items - "Rebalance Model" is admin-only (in development)
  const rebalanceItems = useMemo(() => {
    const items = [
      {
        label: "Invest Cash",
        icon: "fa-chart-pie",
        onClick: () => onInvestCash?.(),
      },
    ]
    // Add "Rebalance Model" for admins only (feature in development)
    if (isAdmin) {
      items.unshift({
        label: "Rebalance Model",
        icon: "fa-balance-scale",
        onClick: () => onSelectPlan?.(),
      })
    }
    return items
  }, [isAdmin, onInvestCash, onSelectPlan])

  return (
    <>
      {/* Refined toolbar - cohesive bar with subtle depth */}
      <div className="flex items-center justify-between py-2 mb-2 gap-3 flex-wrap">
        {/* Left side: View mode and GroupBy controls */}
        {onViewModeChange && !emptyHoldings && (
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* View Mode section */}
            <div className="flex items-center gap-0.5 bg-slate-100/80 backdrop-blur-sm rounded-lg p-0.5 border border-slate-200/60 shadow-sm">
              <span className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                View
              </span>
              {viewModes.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => onViewModeChange(mode.value)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-all duration-200 whitespace-nowrap ${
                    viewMode === mode.value
                      ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/50"
                      : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                  }`}
                  aria-label={`${mode.label} view`}
                  title={mode.label}
                >
                  <ViewModeIcon
                    mode={mode.value}
                    className={`w-3.5 h-3.5 ${viewMode === mode.value ? "text-blue-500" : ""}`}
                  />
                  <span className="hidden lg:inline">{mode.label}</span>
                </button>
              ))}
            </div>

            {/* GroupBy section - more compact on mobile */}
            {!hideGroupBy && (
              <div className="flex items-center gap-0.5 bg-amber-50/80 backdrop-blur-sm rounded-lg p-0.5 border border-amber-200/60 shadow-sm">
                <span className="hidden sm:inline px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-500">
                  Group
                </span>
                {groupOptions.values.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => holdingState.setGroupBy(option)}
                    className={`flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-1.5 text-xs font-medium rounded-md transition-all duration-200 whitespace-nowrap ${
                      holdingState.groupBy.value === option.value
                        ? "bg-white text-slate-900 shadow-sm ring-1 ring-amber-200/50"
                        : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                    }`}
                    aria-label={option.label}
                    title={option.label}
                  >
                    <GroupByIcon
                      groupBy={option.value}
                      className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${holdingState.groupBy.value === option.value ? "text-amber-500" : ""}`}
                    />
                    <span className="hidden xl:inline">{option.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Right side: Action buttons - hidden on mobile portrait */}
        <div className="mobile-portrait:hidden flex items-center gap-2 flex-shrink-0">
          {onShare && (
            <button
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5 shadow-sm bg-white hover:bg-slate-50 text-slate-700 ring-1 ring-slate-200/80 hover:ring-slate-300"
              onClick={onShare}
            >
              <i className="fas fa-share-alt text-[10px] text-blue-500"></i>
              <span className="hidden sm:inline">Share</span>
            </button>
          )}
          {!emptyHoldings && (
            <button
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 flex items-center gap-1.5 shadow-sm ${
                copied
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                  : "bg-white hover:bg-slate-50 text-slate-700 ring-1 ring-slate-200/80 hover:ring-slate-300"
              }`}
              onClick={handleCopyClick}
            >
              <i
                className={`fas ${copied ? "fa-check" : "fa-copy"} text-[10px] ${copied ? "" : "text-blue-500"}`}
              ></i>
              <span className="hidden sm:inline">{getCopyButtonText()}</span>
              <span className="sm:hidden">Copy</span>
            </button>
          )}
          {/* Trade Dropdown */}
          <DropdownMenu
            label="Trade"
            icon="fa-exchange-alt"
            colorClass="bg-emerald-500 hover:bg-emerald-600 shadow-sm shadow-emerald-500/20"
            items={tradeItems}
          />
          {/* Rebalance Dropdown */}
          <DropdownMenu
            label="Rebalance"
            icon="fa-balance-scale"
            colorClass="bg-blue-500 hover:bg-blue-600 shadow-sm shadow-blue-500/20"
            items={rebalanceItems}
          />
        </div>
      </div>
      <TradeInputForm
        portfolio={holdingResults.portfolio}
        modalOpen={tradeModalOpen}
        setModalOpen={handleTradeModalClose}
        initialValues={quickSellData}
      />
      <CashInputForm
        portfolio={holdingResults.portfolio}
        modalOpen={cashModalOpen}
        setModalOpen={setCashModalOpen}
      />
      <CopyPopup
        columns={columns}
        data={holdingResults.positions}
        valueIn={valueIn}
        modalOpen={copyModalOpen}
        onClose={() => setCopyModalOpen(false)}
      />
      {/* Summary Copy Modal */}
      {summaryCopyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black opacity-50"
            onClick={() => setSummaryCopyModalOpen(false)}
          ></div>
          <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-auto p-6 z-50">
            <h2 className="text-xl font-semibold mb-4">
              Select Columns to Copy
            </h2>
            <div className="mb-4 grid grid-cols-2 gap-2">
              {SUMMARY_COLUMNS.map((column) => (
                <label key={column} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedSummaryColumns.includes(column)}
                    onChange={() => handleSummaryColumnChange(column)}
                    className="mr-2"
                  />
                  {column}
                </label>
              ))}
            </div>
            <div className="flex justify-end space-x-2">
              <button
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded"
                onClick={() => setSummaryCopyModalOpen(false)}
              >
                Cancel
              </button>
              <button
                className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
                onClick={handleCopySummary}
                disabled={selectedSummaryColumns.length === 0}
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default HoldingActions
