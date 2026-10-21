import React from "react"
import PriceChartPopup, {
  PriceChartPopupProps,
} from "@components/features/assets/PriceChartPopup"
import RateChartModal from "@components/features/fx/RateChartModal"
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
