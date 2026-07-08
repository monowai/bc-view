import React, { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Dialog from "@components/ui/Dialog"
import DateInput from "@components/ui/DateInput"
import { todayIso } from "@lib/formatters"
import { useDialogSubmit } from "@hooks/useDialogSubmit"
import { BrokerHoldingPosition, BrokerProposalRequest } from "types/beancounter"

interface WeightedSellDialogProps {
  open: boolean
  onClose: () => void
  brokerId: string
  brokerName: string
  holding: BrokerHoldingPosition
  onSubmitted: () => void
}

interface PreviewRow {
  portfolioId: string
  portfolioCode: string
  heldQty: number
  sellQty: number
  proceeds: number
}

// Display up to 6dp, trimming trailing zeros (e.g. 37.500000 -> "37.5").
const trimQty = (qty: number): string => parseFloat(qty.toFixed(6)).toString()

const formatMoney = (amount: number): string =>
  amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const WeightedSellDialog: React.FC<WeightedSellDialogProps> = ({
  open,
  onClose,
  brokerId,
  brokerName,
  holding,
  onSubmitted,
}) => {
  const [percent, setPercent] = useState<string>("50")
  const [price, setPrice] = useState<string>("")
  const [tradeDate, setTradeDate] = useState<string>(todayIso())
  const [isFetchingPrice, setIsFetchingPrice] = useState(false)

  const { isSubmitting, submitError, submitSuccess, handleSubmit, reset } =
    useDialogSubmit({
      autoCloseDelay: 0,
      fallbackError: "Failed to propose sells",
    })

  // Reset form fields once per open+asset combination. Adjusting state
  // during render (rather than in a useEffect) avoids the extra
  // synchronous-setState-in-effect render this would otherwise trigger.
  const openKey = open ? holding.assetId : ""
  const [resetKey, setResetKey] = useState<string>("")
  if (openKey !== resetKey) {
    setResetKey(openKey)
    if (open) {
      setPercent("50")
      setPrice("")
      setTradeDate(todayIso())
      reset()
    }
  }

  // Prefill price from the latest known market price whenever the dialog
  // opens for a (possibly new) asset.
  useEffect(() => {
    if (!open) return undefined

    let cancelled = false
    const fetchPrice = async (): Promise<void> => {
      setIsFetchingPrice(true)
      try {
        const response = await fetch(
          `/api/prices/${holding.market}/${holding.assetCode}`,
        )
        if (!response.ok) return
        const data = await response.json()
        if (!cancelled && data.data && data.data.length > 0) {
          setPrice(String(data.data[0].close))
        }
      } catch {
        // Ignore - user can enter the price manually.
      } finally {
        if (!cancelled) setIsFetchingPrice(false)
      }
    }

    fetchPrice()
    return () => {
      cancelled = true
    }
  }, [open, holding.assetId, holding.market, holding.assetCode])

  const percentNum = parseFloat(percent)
  const priceNum = parseFloat(price)
  const weight = (isNaN(percentNum) ? 0 : percentNum) / 100

  // Mirrors backend rounding: quantities are whole multiples of the asset's
  // board lot (default 1 share), never above the held quantity; boardLot 0
  // means the accounting type permits fractional quantities.
  const boardLot = holding.boardLot ?? 1
  const previewRows: PreviewRow[] = useMemo(() => {
    return (holding.portfolioGroups || [])
      .filter((pg) => pg.quantity > 0)
      .map((pg) => {
        const raw = pg.quantity * weight
        let sellQty = raw
        if (boardLot >= 1) {
          sellQty = Math.round(raw / boardLot) * boardLot
          if (sellQty > pg.quantity) {
            sellQty = Math.floor(pg.quantity / boardLot) * boardLot
          }
        }
        return {
          portfolioId: pg.portfolioId,
          portfolioCode: pg.portfolioCode,
          heldQty: pg.quantity,
          sellQty,
          proceeds: sellQty * (isNaN(priceNum) ? 0 : priceNum),
        }
      })
  }, [holding.portfolioGroups, boardLot, weight, priceNum])

  const proposalCount = previewRows.filter((row) => row.sellQty > 0).length

  const canSubmit =
    !isNaN(percentNum) &&
    percentNum > 0 &&
    percentNum <= 100 &&
    !isNaN(priceNum) &&
    priceNum > 0 &&
    proposalCount > 0

  const handlePropose = async (): Promise<void> => {
    if (!canSubmit) return
    await handleSubmit(async () => {
      const body: BrokerProposalRequest = {
        assetId: holding.assetId,
        trnType: "SELL",
        weight,
        price: priceNum,
        tradeDate,
      }
      const response = await fetch(`/api/trns/broker/${brokerId}/propose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || "Failed to propose sells")
      }
      onSubmitted()
    })
  }

  if (!open) return null

  const assetDisplay = `${holding.market}:${holding.assetCode}`
  const sellsLabel = `Propose ${proposalCount} sell${
    proposalCount === 1 ? "" : "s"
  }`

  return (
    <Dialog
      title={`Sell ${assetDisplay}`}
      onClose={onClose}
      maxWidth="lg"
      scrollable={true}
      footer={
        submitSuccess ? (
          <Dialog.CancelButton onClick={onClose} label={"Close"} />
        ) : (
          <>
            <Dialog.CancelButton onClick={onClose} label={"Cancel"} />
            <Dialog.SubmitButton
              onClick={handlePropose}
              label={sellsLabel}
              loadingLabel={"Proposing..."}
              isSubmitting={isSubmitting}
              disabled={!canSubmit}
              variant="red"
            />
          </>
        )
      }
    >
      <Dialog.ErrorAlert message={submitError} />

      {submitSuccess ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <i className="fas fa-check-circle text-green-500 text-2xl mb-2"></i>
          <p className="text-green-700 font-medium">
            {`Created ${proposalCount} proposed sell${
              proposalCount === 1 ? "" : "s"
            }`}
          </p>
          <Link
            href="/trns/proposed"
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            {"Review proposed transactions"}
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="font-semibold text-lg text-gray-900">
              {assetDisplay}
            </div>
            {holding.assetName && (
              <div className="text-sm text-gray-600">{holding.assetName}</div>
            )}
            <div className="text-sm text-gray-600 mt-1">
              {`Total at ${brokerName}: `}
              <span className="font-medium text-gray-900">
                {trimQty(holding.quantity)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="sell-percent"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {"Percent to sell"}
              </label>
              <input
                id="sell-percent"
                aria-label="Percent to sell"
                type="number"
                min="0"
                max="100"
                step="0.01"
                inputMode="decimal"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500"
              />
            </div>
            <div>
              <label
                htmlFor="sell-price"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                {"Price"}
                {isFetchingPrice && (
                  <span className="ml-1 text-xs text-gray-400">
                    {"(fetching...)"}
                  </span>
                )}
              </label>
              <input
                id="sell-price"
                aria-label="Price"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="sell-trade-date"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {"Trade Date"}
            </label>
            <DateInput
              value={tradeDate}
              onChange={setTradeDate}
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500"
            />
          </div>

          <div className="border rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    {"Portfolio"}
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    {"Held"}
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    {"Sell Qty"}
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    {"Est. Proceeds"}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {previewRows.map((row) => (
                  <tr key={row.portfolioId}>
                    <td className="px-3 py-2 text-sm font-medium text-gray-900">
                      {row.portfolioCode}
                    </td>
                    <td className="px-3 py-2 text-sm text-right font-mono text-gray-600">
                      {trimQty(row.heldQty)}
                    </td>
                    {row.sellQty > 0 ? (
                      <td className="px-3 py-2 text-sm text-right font-mono text-red-600">
                        {trimQty(row.sellQty)}
                      </td>
                    ) : (
                      <td
                        className="px-3 py-2 text-sm text-right font-mono text-gray-400"
                        title="Below board lot"
                      >
                        {"0"}
                      </td>
                    )}
                    <td className="px-3 py-2 text-sm text-right font-mono text-gray-600">
                      {row.sellQty > 0 ? formatMoney(row.proceeds) : "—"}
                    </td>
                  </tr>
                ))}
                {previewRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-4 text-center text-sm text-gray-500"
                    >
                      {"No portfolios hold this position at this broker."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Dialog>
  )
}

export default WeightedSellDialog
