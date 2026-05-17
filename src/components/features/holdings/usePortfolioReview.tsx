import React, { ReactElement, useCallback, useState } from "react"
import PortfolioReviewPopup, {
  PortfolioReviewTarget,
} from "@components/features/holdings/PortfolioReviewPopup"

export interface UsePortfolioReviewReturn {
  popup: ReactElement | null
  showReview: (target: PortfolioReviewTarget) => void
  close: () => void
}

export function usePortfolioReview(): UsePortfolioReviewReturn {
  const [target, setTarget] = useState<PortfolioReviewTarget | null>(null)
  const close = useCallback(() => setTarget(null), [])
  const showReview = useCallback(
    (next: PortfolioReviewTarget) => setTarget(next),
    [],
  )
  const popup = target ? (
    <PortfolioReviewPopup target={target} onClose={close} />
  ) : null
  return { popup, showReview, close }
}
