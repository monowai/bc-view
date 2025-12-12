import React, { useState, useEffect, useCallback } from "react"
import { NumericFormat } from "react-number-format"
import useSwr from "swr"
import { useTranslation } from "next-i18next"
import {
  CorporateEvent,
  Portfolio,
  Position,
  Transaction,
  Asset,
} from "types/beancounter"
import {
  holdingKey,
  simpleFetcher,
  corporateEventsKey,
} from "@utils/api/fetchHelper"
import { isCashRelated } from "@lib/assets/assetUtils"
import {
  calculateEffectivePayDate,
  canProcessEvent,
  isEventReconciled,
  isPositionClosedBeforeEvent,
} from "@lib/corporate-events"

interface PortfolioCorporateActionsPopupProps {
  portfolio: Portfolio
  modalOpen: boolean
  onClose: () => void
}

interface AssetEvent {
  asset: Asset
  event: CorporateEvent
  position: Position
}

const PortfolioCorporateActionsPopup: React.FC<
  PortfolioCorporateActionsPopupProps
> = ({ portfolio, modalOpen, onClose }) => {
  const { t } = useTranslation("common")
  const today = new Date().toISOString().split("T")[0]

  const [isScanning, setIsScanning] = useState(false)
  const [scanComplete, setScanComplete] = useState(false)
  const [missingEvents, setMissingEvents] = useState<AssetEvent[]>([])
  const [scanProgress, setScanProgress] = useState<{
    current: number
    total: number
  } | null>(null)
  const [isBackfilling, setIsBackfilling] = useState(false)
  const [backfillProgress, setBackfillProgress] = useState<{
    current: number
    total: number
  } | null>(null)
  const [processError, setProcessError] = useState<string | null>(null)
  const [processedEvents, setProcessedEvents] = useState<Set<string>>(new Set())

  // Fetch holdings for the portfolio
  const { data: holdingsData } = useSwr(
    modalOpen ? holdingKey(portfolio.code, today) : null,
    modalOpen ? simpleFetcher(holdingKey(portfolio.code, today)) : null,
  )

  // Reset state when modal opens
  useEffect(() => {
    if (modalOpen) {
      setIsScanning(false)
      setScanComplete(false)
      setMissingEvents([])
      setScanProgress(null)
      setIsBackfilling(false)
      setBackfillProgress(null)
      setProcessError(null)
      setProcessedEvents(new Set())
    }
  }, [modalOpen])

  const scanForMissingEvents = useCallback(async () => {
    if (!holdingsData?.data?.positions) return

    setIsScanning(true)
    setScanComplete(false)
    setMissingEvents([])
    setProcessError(null)

    const positions = Object.values(
      holdingsData.data.positions as Record<string, Position>,
    ).filter((pos) => !isCashRelated(pos.asset))

    setScanProgress({ current: 0, total: positions.length })

    const foundMissing: AssetEvent[] = []

    for (let i = 0; i < positions.length; i++) {
      const position = positions[i]
      setScanProgress({ current: i + 1, total: positions.length })

      const fromDate = position.dateValues?.opened || ""
      if (!fromDate) continue

      try {
        // Fetch corporate events for this asset
        const eventsResponse = await fetch(
          corporateEventsKey(position.asset.id, fromDate, today),
        )
        if (!eventsResponse.ok) continue

        const eventsData = await eventsResponse.json()
        const events: CorporateEvent[] = eventsData.data || []

        // Fetch existing transactions for this asset in the portfolio
        const trnsResponse = await fetch(
          `/api/trns/events/${portfolio.id}/${position.asset.id}`,
        )
        const trnsData = trnsResponse.ok
          ? await trnsResponse.json()
          : { data: [] }
        const portfolioTransactions: Transaction[] = trnsData.data || []

        // Find events that are not reconciled and can be processed
        // Skip events for positions that were closed before the event
        for (const event of events) {
          if (
            !isPositionClosedBeforeEvent(position, event) &&
            !isEventReconciled(event, portfolioTransactions) &&
            canProcessEvent(event, today)
          ) {
            foundMissing.push({
              asset: position.asset,
              event,
              position,
            })
          }
        }
      } catch {
        // Continue scanning other assets if one fails
      }
    }

    setMissingEvents(foundMissing)
    setIsScanning(false)
    setScanComplete(true)
    setScanProgress(null)
  }, [portfolio.id, holdingsData.data.positions])

  const handleBackfillAll = async (): Promise<void> => {
    if (missingEvents.length === 0) return

    setIsBackfilling(true)
    setProcessError(null)
    setBackfillProgress({ current: 0, total: missingEvents.length })

    const newProcessed = new Set(processedEvents)

    for (let i = 0; i < missingEvents.length; i++) {
      const { event } = missingEvents[i]
      setBackfillProgress({ current: i + 1, total: missingEvents.length })

      if (newProcessed.has(event.id)) continue

      try {
        const response = await fetch(
          `/api/corporate-events/process/${event.id}`,
          { method: "POST" },
        )

        if (response.ok) {
          newProcessed.add(event.id)
        }
      } catch {
        // Continue with next event
      }
    }

    setProcessedEvents(newProcessed)
    setIsBackfilling(false)
    setBackfillProgress(null)
  }

  const handleProcessEvent = async (eventId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/corporate-events/process/${eventId}`, {
        method: "POST",
      })

      if (response.ok) {
        setProcessedEvents((prev) => new Set(prev).add(eventId))
      } else {
        setProcessError(t("corporate.error.process"))
      }
    } catch {
      setProcessError(t("corporate.error.process"))
    }
  }

  if (!modalOpen) {
    return null
  }

  const getEventTypeLabel = (trnType: string): string => {
    switch (trnType) {
      case "DIVI":
        return t("corporate.type.dividend")
      case "SPLIT":
        return t("corporate.type.split")
      default:
        return trnType
    }
  }

  const getEventTypeIcon = (trnType: string): string => {
    switch (trnType) {
      case "DIVI":
        return "fa-money-bill-wave"
      case "SPLIT":
        return "fa-code-branch"
      default:
        return "fa-calendar"
    }
  }

  const unprocessedCount = missingEvents.filter(
    (e) => !processedEvents.has(e.event.id),
  ).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black opacity-50"
        onClick={onClose}
      ></div>
      <div className="bg-white rounded-lg shadow-lg w-full max-w-4xl mx-auto p-6 z-50 max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            {t("corporate.portfolio.title")} - {portfolio.code}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4 text-sm text-blue-800">
          <i className="fas fa-info-circle mr-2"></i>
          {t("corporate.portfolio.info")}
        </div>

        {!scanComplete && !isScanning && (
          <div className="flex flex-col items-center justify-center py-8">
            <p className="text-gray-600 mb-4">
              {t("corporate.portfolio.scan.prompt")}
            </p>
            <button
              className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors flex items-center"
              onClick={scanForMissingEvents}
              disabled={!holdingsData}
            >
              <i className="fas fa-search mr-2"></i>
              {t("corporate.portfolio.scan")}
            </button>
          </div>
        )}

        {isScanning && (
          <div className="flex flex-col items-center justify-center py-8">
            <i className="fas fa-spinner fa-spin text-3xl text-blue-500 mb-4"></i>
            <p className="text-gray-600">
              {t("corporate.portfolio.scanning")}
              {scanProgress && (
                <span className="ml-2">
                  ({scanProgress.current}/{scanProgress.total})
                </span>
              )}
            </p>
          </div>
        )}

        {scanComplete && (
          <div className="overflow-y-auto flex-1">
            {missingEvents.length === 0 ? (
              <div className="text-center py-8 text-green-600">
                <i className="fas fa-check-circle text-4xl mb-4"></i>
                <p>{t("corporate.portfolio.noMissing")}</p>
              </div>
            ) : (
              <>
                <div className="mb-4 text-sm text-gray-600">
                  {t("corporate.portfolio.found", {
                    count: missingEvents.length,
                  })}
                </div>
                <table className="min-w-full bg-white">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left">
                        {t("trn.asset.code")}
                      </th>
                      <th className="px-4 py-2 text-left">
                        {t("corporate.type")}
                      </th>
                      <th className="px-4 py-2 text-left">
                        {t("corporate.recordDate")}
                      </th>
                      <th className="px-4 py-2 text-left">
                        {t("corporate.effectiveDate")}
                      </th>
                      <th className="px-4 py-2 text-right">
                        {t("corporate.rate")}
                      </th>
                      <th className="px-4 py-2 text-center">
                        {t("corporate.actions")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {missingEvents.map(({ asset, event }) => {
                      const isProcessed = processedEvents.has(event.id)
                      return (
                        <tr
                          key={event.id}
                          className={`border-t hover:bg-gray-50 transition-colors ${
                            isProcessed ? "bg-green-50" : ""
                          }`}
                        >
                          <td className="px-4 py-2">
                            <div className="font-medium">{asset.code}</div>
                            <div className="text-xs text-gray-500">
                              {asset.name}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <span className="flex items-center">
                              <i
                                className={`fas ${getEventTypeIcon(event.trnType)} mr-2 text-blue-500`}
                              ></i>
                              {getEventTypeLabel(event.trnType)}
                            </span>
                          </td>
                          <td className="px-4 py-2">{event.recordDate}</td>
                          <td className="px-4 py-2">
                            {calculateEffectivePayDate(event)}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {event.trnType === "DIVI" ? (
                              <NumericFormat
                                value={event.rate}
                                displayType={"text"}
                                decimalScale={4}
                                fixedDecimalScale={true}
                                thousandSeparator={true}
                              />
                            ) : (
                              <NumericFormat
                                value={event.split}
                                displayType={"text"}
                                decimalScale={4}
                                fixedDecimalScale={true}
                              />
                            )}
                          </td>
                          <td className="px-4 py-2 text-center">
                            {isProcessed ? (
                              <span className="text-green-500">
                                <i className="fas fa-check mr-1"></i>
                                {t("corporate.transactionCreated")}
                              </span>
                            ) : (
                              <button
                                onClick={() => handleProcessEvent(event.id)}
                                className="text-blue-500 hover:text-blue-700"
                                title={t("corporate.process")}
                              >
                                <i className="fas fa-play"></i>
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </>
            )}
          </div>
        )}

        <div className="flex justify-between items-center mt-4 pt-4 border-t">
          <div className="flex items-center gap-2 flex-wrap">
            {scanComplete && missingEvents.length > 0 && (
              <button
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                onClick={handleBackfillAll}
                disabled={isBackfilling || unprocessedCount === 0}
                title={t("corporate.backfill.hint")}
              >
                {isBackfilling ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-2"></i>
                    {backfillProgress
                      ? `${backfillProgress.current}/${backfillProgress.total}`
                      : t("corporate.loading")}
                  </>
                ) : (
                  <>
                    <i className="fas fa-forward mr-2"></i>
                    {t("corporate.backfill")} ({unprocessedCount})
                  </>
                )}
              </button>
            )}
            {processError && (
              <span className="text-red-500 text-sm">
                <i className="fas fa-exclamation-circle mr-1"></i>
                {processError}
              </span>
            )}
          </div>
          <button
            className="bg-gray-300 text-gray-700 px-4 py-2 rounded hover:bg-gray-400 transition-colors"
            onClick={onClose}
          >
            {t("cancel")}
          </button>
        </div>
      </div>
    </div>
  )
}

export default PortfolioCorporateActionsPopup
