import React, { ReactElement, useCallback, useState } from "react"
import { Asset } from "types/beancounter"
import { usePermissions } from "@hooks/usePermissions"
import HoldingAnalysisPopup from "./HoldingAnalysisPopup"

interface AnalysisTarget {
  ticker: string
  market: string
  portfolioCode: string
}

export interface UseHoldingAnalysisReturn {
  /** Render this where you want the popup to appear; null when not active. */
  popup: ReactElement | null
  /** False when the viewer may not run AI features at all. */
  enabled: boolean
  /** Open a Holding Analysis of `asset` as held in `portfolioCode`. */
  showAnalysis: (asset: Asset, portfolioCode: string) => void
}

/**
 * Holding Analysis popup state for a holding view (row or card). Same
 * permission gate as the news and review buttons.
 */
export function useHoldingAnalysis(): UseHoldingAnalysisReturn {
  const { canUseAi: enabled } = usePermissions()
  const [target, setTarget] = useState<AnalysisTarget | null>(null)
  const close = useCallback(() => setTarget(null), [])
  const showAnalysis = useCallback(
    (asset: Asset, portfolioCode: string) => {
      if (!enabled) return
      setTarget({
        ticker: asset.displayCode,
        market: asset.market.code,
        portfolioCode,
      })
    },
    [enabled],
  )
  const popup = target ? (
    <HoldingAnalysisPopup
      key={`${target.portfolioCode}|${target.ticker}|${target.market}`}
      ticker={target.ticker}
      market={target.market}
      portfolioCode={target.portfolioCode}
      onClose={close}
    />
  ) : null
  return { popup, enabled, showAnalysis }
}
