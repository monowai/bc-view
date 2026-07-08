import React, { useState } from "react"
import useSWR, { useSWRConfig } from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"
import Spinner from "@components/ui/Spinner"
import WeightedSellDialog from "@components/features/brokers/WeightedSellDialog"
import {
  AssetBrokerHolding,
  AssetBrokerHoldingsResponse,
} from "types/beancounter"

interface AssetBrokersTabProps {
  assetId: string
}

const formatQuantity = (value: number): string =>
  new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(value)

/**
 * Brokers tab on the asset lookup page — shows which brokers hold the
 * selected asset (and across which portfolios), with a per-broker Sell
 * action that reuses WeightedSellDialog (as on /brokers/[brokerId]/holdings).
 */
export default function AssetBrokersTab({
  assetId,
}: AssetBrokersTabProps): React.ReactElement {
  const [sellHolding, setSellHolding] = useState<AssetBrokerHolding | null>(
    null,
  )
  const { mutate } = useSWRConfig()

  const brokersKey = `/api/assets/${assetId}/brokers`
  const { data, isLoading } = useSWR<AssetBrokerHoldingsResponse>(
    brokersKey,
    simpleFetcher(brokersKey),
  )

  const brokerHoldings = data?.data || []

  const handleSellSubmitted = (): void => {
    mutate(brokersKey)
  }

  if (isLoading) {
    return (
      <div className="p-8 text-center text-gray-500">
        <Spinner className="mr-2" />
        {"Loading..."}
      </div>
    )
  }

  if (brokerHoldings.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <i className="fas fa-building-columns text-3xl mb-2 text-gray-300"></i>
        <p>{"This asset is not held at any broker"}</p>
      </div>
    )
  }

  return (
    <div>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {"Broker"}
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              {"Quantity"}
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              {"Portfolios"}
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              {"Actions"}
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {brokerHoldings.map((abh) => {
            const canSell = abh.brokerId !== "NO_BROKER"
            const portfolioCodes = (abh.holding.portfolioGroups || [])
              .map((pg) => pg.portfolioCode)
              .join(", ")
            return (
              <tr key={abh.brokerId} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {abh.brokerName}
                </td>
                <td className="px-4 py-3 text-right text-gray-900 tabular-nums">
                  {formatQuantity(abh.holding.quantity)}
                </td>
                <td className="px-4 py-3 text-gray-500 text-sm">
                  {portfolioCodes || "-"}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => setSellHolding(abh)}
                    disabled={!canSell}
                    className="text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
                    title={
                      canSell
                        ? "Sell"
                        : "Cannot sell — no broker assigned to these holdings"
                    }
                  >
                    <i className="fas fa-hand-holding-usd mr-1"></i>
                    {"Sell"}
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {sellHolding && (
        <WeightedSellDialog
          open={true}
          onClose={() => setSellHolding(null)}
          brokerId={sellHolding.brokerId}
          brokerName={sellHolding.brokerName}
          holding={sellHolding.holding}
          onSubmitted={handleSellSubmitted}
        />
      )}
    </div>
  )
}
