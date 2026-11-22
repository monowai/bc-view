import React from "react"
import dynamic from "next/dynamic"
import type { PriceChartPopupProps } from "@components/features/assets/PriceChartPopup"
import { ChartModalPlaceholder } from "@components/ui/ChartPlaceholder"

// Both charts open on demand, so their code (and recharts) loads on first open.
const PriceChartPopup = dynamic(
  () => import("@components/features/assets/PriceChartPopup"),
  { ssr: false, loading: () => <ChartModalPlaceholder /> },
)
const RateChartModal = dynamic(
  () => import("@components/features/fx/RateChartModal"),
  { ssr: false, loading: () => <ChartModalPlaceholder /> },
)
import { fxPairLegs } from "@lib/assets/assetUtils"

/**
 * The chart for an asset: a currency pair opens the FX rate chart (base to
 * quote), anything else the price chart.
 */
export default function AssetChart(
  props: PriceChartPopupProps,
): React.ReactElement {
  const legs = fxPairLegs(props.asset)
  if (legs) {
    return (
      <RateChartModal from={legs.from} to={legs.to} onClose={props.onClose} />
    )
  }
  return <PriceChartPopup {...props} />
}
