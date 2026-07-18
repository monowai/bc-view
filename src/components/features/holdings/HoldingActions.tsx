import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useMemo,
} from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/router"
import TradeInputForm from "@components/features/transactions/TradeInputForm"
import CashInputForm from "@components/features/transactions/CashInputForm"
import CopyPopup from "@components/ui/CopyPopup"
import { HoldingContract, QuickSellData } from "types/beancounter"
import { ViewMode, VIEW_MODES } from "./ViewToggle"
import {
  GroupBy,
  useGroupOptions,
} from "@components/features/holdings/GroupByOptions"
import { useHoldingState } from "@lib/holdings/holdingState"
import { usePermissions } from "@hooks/usePermissions"
import { usePortfolioReview } from "@components/features/holdings/usePortfolioReview"

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
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<{ top: number; right: number }>({
    top: 0,
    right: 0,
  })

  // The panel is rendered in a portal (fixed position) rather than as an
  // `absolute` child, because the enclosing single-row icon ribbon is
  // `overflow-x-auto` (#1021). A scroll container with a non-visible overflow-x
  // also clips overflow-y, which clipped the panel out of view on narrow/mobile
  // widths. Position it against the trigger's viewport rect instead.
  const positionPanel = (): void => {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (rect) {
      setCoords({ top: rect.bottom + 6, right: window.innerWidth - rect.right })
    }
  }

  useLayoutEffect(() => {
    const onReflow = (): void => positionPanel()
    if (isOpen) {
      positionPanel()
      window.addEventListener("resize", onReflow)
      window.addEventListener("scroll", onReflow, true)
    }
    return () => {
      window.removeEventListener("resize", onReflow)
      window.removeEventListener("scroll", onReflow, true)
    }
  }, [isOpen])

  // Close when clicking outside the trigger or the portalled panel.
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent): void => {
      const target = event.target as Node
      if (
        !buttonRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  return (
    <>
      <button
        ref={buttonRef}
        className={`w-auto ${colorClass} text-white px-2 py-1 rounded-lg text-xs font-medium transition-all duration-200 flex items-center justify-center gap-1 ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-label={label}
        title={label}
      >
        <i className={`fas ${icon} text-xs`}></i>
        <i
          className={`fas fa-chevron-down text-[8px] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        ></i>
      </button>
      {isOpen &&
        createPortal(
          <div
            ref={panelRef}
            style={{ top: coords.top, right: coords.right }}
            className="fixed w-44 bg-white rounded-lg shadow-lg shadow-slate-200/50 border border-slate-200/80 z-50 overflow-hidden"
          >
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
          </div>,
          document.body,
        )}
    </>
  )
}

interface HoldingActionsProps {
  holdingResults: HoldingContract
  columns: string[]
  valueIn: string
  quickSellData?: QuickSellData
  onQuickSellHandled?: () => void
  emptyHoldings?: boolean
  viewMode?: ViewMode
  onViewModeChange?: (mode: ViewMode) => void
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
export const ViewModeIcon: React.FC<{ mode: string; className?: string }> = ({
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
export const GroupByIcon: React.FC<{ groupBy: string; className?: string }> = ({
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

const viewModes = VIEW_MODES

const HoldingActions: React.FC<HoldingActionsProps> = ({
  holdingResults,
  columns,
  valueIn,
  quickSellData,
  onQuickSellHandled,
  emptyHoldings = false,
  viewMode = "table",
  onViewModeChange,
  hideGroupBy = false,
  onShare,
  onSelectPlan,
  onInvestCash,
}) => {
  const router = useRouter()
  const {
    admin: isAdmin,
    ai: canRunAi,
    isLoading: permsLoading,
  } = usePermissions()
  const holdingState = useHoldingState()
  const groupOptions = useGroupOptions()
  const { popup: reviewPopup, showReview } = usePortfolioReview()
  const [tradeModalOpen, setTradeModalOpen] = useState(false)
  const [cashModalOpen, setCashModalOpen] = useState(false)

  // Open trade/cash modal via ?action= query parameter (used by mobile
  // header). Reading router.query during render and rewriting the URL is
  // the side effect this component is meant to perform — it's not derived
  // state, so the compiler warning is intentional behaviour.
  useEffect(() => {
    if (router.query.action === "trade") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // Open trade modal when quick sell data is provided. quickSellData is an
  // external trigger from the parent — opening the modal is the side
  // effect, not derived state.
  useEffect(() => {
    if (quickSellData) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const handleCopyClick = (): void => {
    setCopyModalOpen(true)
  }

  // Get button text based on view mode
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
      {
        // Ad-hoc rebalance: opens the multi-position rebalance editor seeded
        // from live holdings (all deltas zero, no model/plan). Available to
        // all users — unlike "Rebalance Model" below, it doesn't rely on the
        // (still in-development) model/plan feature.
        label: "Rebalance Weights",
        icon: "fa-sliders-h",
        onClick: () =>
          router.push(
            `/rebalance/execute?adhoc=1&portfolios=${holdingResults.portfolio.id}&currency=${holdingResults.portfolio.currency.code}`,
          ),
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
  }, [
    isAdmin,
    onInvestCash,
    onSelectPlan,
    router,
    holdingResults.portfolio.id,
    holdingResults.portfolio.currency.code,
  ])

  return (
    <>
      {/* Single-row icon ribbon - no wrap, minimal vertical footprint */}
      <div className="flex items-center justify-between py-1 mb-1 gap-1.5 overflow-x-auto">
        {/* Left side: View mode and GroupBy controls */}
        {onViewModeChange && !emptyHoldings && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* View Mode section */}
            <div className="flex items-center gap-0.5 bg-slate-100/80 backdrop-blur-sm rounded-lg p-0.5 border border-slate-200/60 shadow-sm">
              {viewModes.map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => onViewModeChange(mode.value)}
                  className={`flex items-center justify-center w-7 h-7 rounded-md transition-all duration-200 ${
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
                </button>
              ))}
            </div>

            {/* GroupBy section */}
            {!hideGroupBy && (
              <div className="flex items-center gap-0.5 bg-amber-50/80 backdrop-blur-sm rounded-lg p-0.5 border border-amber-200/60 shadow-sm">
                {groupOptions.values.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => holdingState.setGroupBy(option)}
                    className={`flex items-center justify-center w-7 h-7 rounded-md transition-all duration-200 ${
                      holdingState.groupBy.value === option.value
                        ? "bg-white text-slate-900 shadow-sm ring-1 ring-amber-200/50"
                        : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
                    }`}
                    aria-label={option.label}
                    title={option.label}
                  >
                    <GroupByIcon
                      groupBy={option.value}
                      className={`w-3.5 h-3.5 ${holdingState.groupBy.value === option.value ? "text-amber-500" : ""}`}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Right side: icon-only action buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {!permsLoading && canRunAi && !emptyHoldings && (
            <button
              type="button"
              className="flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-200 shadow-sm bg-white hover:bg-slate-50 text-slate-700 ring-1 ring-slate-200/80 hover:ring-slate-300"
              onClick={() =>
                showReview({
                  kind: "portfolio",
                  id: holdingResults.portfolio.id,
                  code: holdingResults.portfolio.code,
                  name: holdingResults.portfolio.name,
                })
              }
              aria-label="AI summary of this portfolio"
              title="AI summary: headwinds, tailwinds, key news on winners and losers"
            >
              <i className="fas fa-robot text-xs text-blue-500"></i>
            </button>
          )}
          {onShare && (
            <button
              className="flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-200 shadow-sm bg-white hover:bg-slate-50 text-slate-700 ring-1 ring-slate-200/80 hover:ring-slate-300"
              onClick={onShare}
              aria-label="Share"
              title="Share"
            >
              <i className="fas fa-share-alt text-xs text-blue-500"></i>
            </button>
          )}
          {!emptyHoldings && (
            <button
              className="flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-200 shadow-sm bg-white hover:bg-slate-50 text-slate-700 ring-1 ring-slate-200/80 hover:ring-slate-300"
              onClick={handleCopyClick}
              aria-label="Copy Holdings"
              title="Copy Holdings"
            >
              <i className="fas fa-copy text-xs text-blue-500"></i>
            </button>
          )}
          {/* Trade Dropdown */}
          <DropdownMenu
            label="Trade"
            icon="fa-exchange-alt"
            colorClass="bg-emerald-500 hover:bg-emerald-600 shadow-sm shadow-emerald-500/20"
            items={tradeItems}
          />
          {/* Invest (rebalance) Dropdown */}
          <DropdownMenu
            label="Invest"
            icon="fa-balance-scale"
            colorClass="bg-blue-500 hover:bg-blue-600 shadow-sm shadow-blue-500/20"
            items={rebalanceItems}
          />
        </div>
      </div>
      {tradeModalOpen && (
        // Lazy-mount: TradeInputForm calls useSwr("/api/portfolios") in its
        // body. Mounting it unconditionally fires the fetch on every holdings
        // pageload even when the trade dialog is closed, producing a duplicate
        // /api/portfolios call alongside the page's own keyed fetch (the bare
        // URL doesn't match the portfoliosKey cache slot). Gate on
        // tradeModalOpen so the form's hooks only run when the dialog opens.
        <TradeInputForm
          portfolio={holdingResults.portfolio}
          modalOpen={tradeModalOpen}
          setModalOpen={handleTradeModalClose}
          initialValues={quickSellData}
        />
      )}
      {cashModalOpen && (
        // Lazy-mount: CashInputForm calls useSwr for both
        // /api/assets?category=ACCOUNT and /api/assets?category=TRADE in its
        // body. Mounting unconditionally fires both fetches on every holdings
        // pageload even when the cash dialog is closed (~62ms + 64ms apiece in
        // the trace). Gate on cashModalOpen so the hooks only run when the
        // dialog opens — same pattern as TradeInputForm.
        <CashInputForm
          portfolio={holdingResults.portfolio}
          modalOpen={cashModalOpen}
          setModalOpen={setCashModalOpen}
        />
      )}
      <CopyPopup
        columns={columns}
        data={holdingResults.positions}
        valueIn={valueIn}
        modalOpen={copyModalOpen}
        onClose={() => setCopyModalOpen(false)}
      />
      {reviewPopup}
    </>
  )
}

export default HoldingActions
