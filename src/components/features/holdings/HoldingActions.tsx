import React, { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useRouter } from "next/router"
import TradeInputForm from "@pages/trns/trade"
import CashInputForm from "@pages/trns/cash"
import CopyPopup from "@components/ui/CopyPopup"
import CreateModelFromHoldingsDialog from "@components/features/rebalance/models/CreateModelFromHoldingsDialog"
import SelectPlanDialog from "@components/features/rebalance/execution/SelectPlanDialog"
import InvestCashDialog from "@components/features/rebalance/execution/InvestCashDialog"
import { HoldingContract, Holdings, QuickSellData } from "types/beancounter"
import { ViewMode } from "./ViewToggle"
import { AllocationSlice } from "@lib/allocation/aggregateHoldings"
import { ModelDto, PlanDto } from "types/rebalance"
import { useIsAdmin } from "@hooks/useIsAdmin"

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
        className={`mobile-portrait:hidden w-full sm:w-auto ${colorClass} text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center justify-center ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <i className={`fas ${icon} mr-2`}></i>
        {label}
        <i className={`fas fa-chevron-down ml-2 text-xs`}></i>
      </button>
      {isOpen && (
        <div className="absolute left-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          {items.map((item, index) => (
            <button
              key={index}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg flex items-center"
              onClick={() => {
                setIsOpen(false)
                item.onClick()
              }}
            >
              <i className={`fas ${item.icon} mr-2 w-4 text-gray-500`}></i>
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
  allocationData?: AllocationSlice[]
  holdings?: Holdings | null
}

const HoldingActions: React.FC<HoldingActionsProps> = ({
  holdingResults,
  columns,
  valueIn,
  quickSellData,
  onQuickSellHandled,
  emptyHoldings = false,
  viewMode = "table",
  allocationData = [],
  holdings,
}) => {
  const router = useRouter()
  const { isAdmin } = useIsAdmin()
  const [tradeModalOpen, setTradeModalOpen] = useState(false)
  const [cashModalOpen, setCashModalOpen] = useState(false)
  const [copyModalOpen, setCopyModalOpen] = useState(false)
  const [summaryCopyModalOpen, setSummaryCopyModalOpen] = useState(false)
  const [selectPlanModalOpen, setSelectPlanModalOpen] = useState(false)
  const [createModelModalOpen, setCreateModelModalOpen] = useState(false)
  const [investCashModalOpen, setInvestCashModalOpen] = useState(false)
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
        onClick: () => setInvestCashModalOpen(true),
      },
    ]
    // Add "Rebalance Model" for admins only (feature in development)
    if (isAdmin) {
      items.unshift({
        label: "Rebalance Model",
        icon: "fa-balance-scale",
        onClick: () => setSelectPlanModalOpen(true),
      })
    }
    return items
  }, [isAdmin])

  return (
    <div
      className={`flex flex-col sm:flex-row py-2 space-y-2 sm:space-y-0 sm:space-x-2 mb-4 ${emptyHoldings ? "justify-start" : "justify-end"}`}
    >
      {!emptyHoldings && (
        <button
          className={`mobile-portrait:hidden w-full sm:w-auto px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center justify-center ${
            copied
              ? "bg-green-500 hover:bg-green-600 text-white"
              : "bg-blue-500 hover:bg-blue-600 text-white"
          }`}
          onClick={handleCopyClick}
        >
          <i className={`fas ${copied ? "fa-check" : "fa-copy"} mr-2`}></i>
          {getCopyButtonText()}
        </button>
      )}
      {/* Trade Dropdown */}
      <DropdownMenu
        label="Trade"
        icon="fa-exchange-alt"
        colorClass="bg-green-500 hover:bg-green-600"
        items={tradeItems}
      />
      {/* Rebalance Dropdown */}
      <DropdownMenu
        label="Rebalance"
        icon="fa-balance-scale"
        colorClass="bg-indigo-500 hover:bg-indigo-600"
        items={rebalanceItems}
      />
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
      {/* Select Plan Dialog for Rebalancing */}
      <SelectPlanDialog
        modalOpen={selectPlanModalOpen}
        portfolioId={holdingResults.portfolio.id}
        onClose={() => setSelectPlanModalOpen(false)}
        onSelectPlan={(model: ModelDto, plan: PlanDto) => {
          setSelectPlanModalOpen(false)
          const source = encodeURIComponent(router.asPath)
          router.push(
            `/rebalance/execute?planId=${plan.id}&modelId=${model.id}&portfolios=${holdingResults.portfolio.id}&source=${source}`,
          )
        }}
        onCreateNew={() => {
          setSelectPlanModalOpen(false)
          setCreateModelModalOpen(true)
        }}
      />
      {/* Create Model from Holdings Dialog */}
      {createModelModalOpen && holdings && (
        <CreateModelFromHoldingsDialog
          modalOpen={createModelModalOpen}
          holdings={holdings}
          portfolioCode={holdingResults.portfolio.code}
          onClose={() => setCreateModelModalOpen(false)}
          onSuccess={(model) => {
            setCreateModelModalOpen(false)
            router.push(`/rebalance/models/${model.id}`)
          }}
        />
      )}
      {/* Invest Cash Dialog */}
      <InvestCashDialog
        modalOpen={investCashModalOpen}
        portfolioId={holdingResults.portfolio.id}
        onClose={() => setInvestCashModalOpen(false)}
        onSuccess={() => {
          setInvestCashModalOpen(false)
          router.replace(router.asPath)
        }}
      />
    </div>
  )
}

export default HoldingActions
