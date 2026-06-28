import React, { useState } from "react"
import { AssetOption, Portfolio, QuickSellData } from "types/beancounter"
import { usePortfolios } from "@hooks/usePortfolios"
import Dialog from "@components/ui/Dialog"
import TradeInputForm from "@components/features/transactions/TradeInputForm"

interface TradeAssetActionProps {
  // The looked-up asset to trade. Carries code (symbol) + market, which is all
  // the trade form needs — it resolves/creates the backend asset on submit.
  asset: AssetOption
}

// "idle" → nothing open. "picking" → portfolio prompt. "trading" → the normal
// trade dialog, pinned to the portfolio the user picked.
type Phase =
  | { kind: "idle" }
  | { kind: "picking" }
  | { kind: "trading"; portfolio: Portfolio }

/**
 * "Trade this asset" action for the asset lookup page. Prompts for the target
 * portfolio first, then opens the standard TradeInputForm pre-filled with the
 * asset. A single-portfolio user skips the prompt (no real choice).
 */
export default function TradeAssetAction({
  asset,
}: TradeAssetActionProps): React.ReactElement {
  const { portfolios } = usePortfolios()
  const [phase, setPhase] = useState<Phase>({ kind: "idle" })

  // Fresh trade: prime the asset + a BUY default. quantity/price are left at 0
  // for the user to fill; the form fetches the live price when they pick a date.
  const initialValues: QuickSellData = {
    asset: asset.symbol,
    assetId: asset.assetId,
    market: asset.market || "",
    currency: asset.currency,
    quantity: 0,
    price: 0,
    type: "BUY",
  }

  const start = (): void => {
    if (portfolios.length === 1) {
      setPhase({ kind: "trading", portfolio: portfolios[0] })
    } else {
      setPhase({ kind: "picking" })
    }
  }

  const close = (): void => setPhase({ kind: "idle" })

  const noPortfolios = portfolios.length === 0

  return (
    <>
      <button
        type="button"
        onClick={start}
        disabled={noPortfolios}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed"
        aria-label={`Trade ${asset.symbol}`}
        title={noPortfolios ? "Create a portfolio first" : "Trade this asset"}
      >
        <i className="fas fa-right-left"></i>
        <span>{"Trade"}</span>
      </button>

      {phase.kind === "picking" && (
        <Dialog
          title={`Trade ${asset.symbol} — choose portfolio`}
          onClose={close}
          maxWidth="md"
          scrollable
        >
          <p className="text-sm text-gray-500">
            {"Which portfolio do you want to trade this asset into?"}
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {portfolios.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPhase({ kind: "trading", portfolio: p })}
                className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg text-left hover:border-invest-300 hover:bg-invest-50 focus:outline-none focus:ring-2 focus:ring-invest-500"
              >
                <span>
                  <span className="font-medium text-gray-900">{p.name}</span>
                  <span className="block text-sm text-gray-500">{p.code}</span>
                </span>
                <span className="text-sm text-gray-500">{p.currency.code}</span>
              </button>
            ))}
          </div>
        </Dialog>
      )}

      {phase.kind === "trading" && (
        <TradeInputForm
          portfolio={phase.portfolio}
          modalOpen={true}
          setModalOpen={(open) => {
            if (!open) close()
          }}
          initialValues={initialValues}
        />
      )}
    </>
  )
}
