import type { ValueInOption } from "types/constants"
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
import CopyPopup from "@components/features/holdings/CopyPopup"
import { HoldingContract, QuickSellData } from "types/beancounter"
import { ViewMode } from "./ViewToggle"
import HoldingsViewControls from "./HoldingsViewControls"
import { usePermissions } from "@hooks/usePermissions"
import { usePortfolioReview } from "@components/features/portfolios/usePortfolioReview"

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
  valueIn: ValueInOption
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
  const { admin: isAdmin, canUseAi, isLoading: permsLoading } = usePermissions()
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
          <HoldingsViewControls
            viewMode={viewMode}
            onViewModeChange={onViewModeChange}
            hideGroupBy={hideGroupBy}
          />
        )}

        {/* Right side: icon-only action buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {!permsLoading && canUseAi && !emptyHoldings && (
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
          // svc-position already weighed this holding; show its answer rather
          // than deriving a second one that can disagree with the row.
          currentWeightOverride={quickSellData?.currentWeight ?? null}
          // ...and weigh the resulting position against the SAME total it used.
          // `portfolio.marketValue` is a different valuation, so pairing the two
          // put the current and resulting weights on different denominators —
          // a target typed in came back out as something else.
          weightBasisMarketValue={holdingResults.totals?.PORTFOLIO?.marketValue}
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
