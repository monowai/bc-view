import React, { useState } from "react"
import { NumericFormat } from "react-number-format"
import useSwr from "swr"
import { useTranslation } from "next-i18next"
import { CorporateEvent, Asset, Transaction } from "types/beancounter"
import {
  corporateEventsKey,
  eventKey,
  simpleFetcher,
} from "@utils/api/fetchHelper"

interface CorporateActionsPopupProps {
  asset: Asset
  portfolioId: string
  fromDate: string
  toDate?: string // Optional - defaults to today if not provided
  modalOpen: boolean
  onClose: () => void
}

// Calculate effective pay date for dividends (recordDate + 18 days)
const calculateEffectivePayDate = (event: CorporateEvent): string => {
  if (event.trnType !== "DIVI") {
    return event.payDate
  }
  const recordDate = new Date(event.recordDate)
  recordDate.setDate(recordDate.getDate() + 18)
  return recordDate.toISOString().split("T")[0]
}

// Check if an event can be processed (effective pay date <= reference date)
const canProcessEvent = (
  event: CorporateEvent,
  referenceDate: string,
): boolean => {
  if (event.trnType !== "DIVI") {
    return true // Splits can always be processed
  }
  const effectivePayDate = calculateEffectivePayDate(event)
  return effectivePayDate <= referenceDate
}

// Check if a corporate event has a matching transaction in the portfolio
// Matches on trnType and checks if transaction date falls within a reasonable window
// around the record date (dividends typically pay 2-4 weeks after record date)
const isEventReconciled = (
  event: CorporateEvent,
  portfolioTransactions: Transaction[],
): boolean => {
  const recordDate = new Date(event.recordDate)
  // Window: from record date to record date + 45 days (covers most dividend payment periods)
  const windowEnd = new Date(recordDate)
  windowEnd.setDate(windowEnd.getDate() + 45)

  return portfolioTransactions.some((trn) => {
    if (trn.trnType !== event.trnType) return false
    const trnDate = new Date(trn.tradeDate)
    return trnDate >= recordDate && trnDate <= windowEnd
  })
}

const CorporateActionsPopup: React.FC<CorporateActionsPopupProps> = ({
  asset,
  portfolioId,
  fromDate: fromDateProp,
  toDate: toDateProp,
  modalOpen,
  onClose,
}) => {
  const { t } = useTranslation("common")
  const today = new Date().toISOString().split("T")[0]

  // Helper to validate date string
  const isValidDate = (dateStr: string | undefined): boolean => {
    if (!dateStr) return false
    const date = new Date(dateStr)
    return !isNaN(date.getTime())
  }

  // Use provided toDate or default to today
  const toDate = isValidDate(toDateProp) ? toDateProp! : today

  // Calculate default fromDate (1 year before toDate)
  const defaultFromDate = (() => {
    const date = new Date(toDate)
    date.setFullYear(date.getFullYear() - 1)
    return date.toISOString().split("T")[0]
  })()

  // Use provided fromDate or default
  const fromDate = isValidDate(fromDateProp) ? fromDateProp! : defaultFromDate
  const [isLoadingEvents, setIsLoadingEvents] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadSuccess, setLoadSuccess] = useState(false)
  const [processingEventId, setProcessingEventId] = useState<string | null>(
    null,
  )
  const [processError, setProcessError] = useState<string | null>(null)
  const [processSuccess, setProcessSuccess] = useState<string | null>(null)
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [overridePayDate, setOverridePayDate] = useState<string>("")
  const [processedPayDates, setProcessedPayDates] = useState<
    Record<string, string>
  >({}) // Track which events were processed with which date
  const [isBackfilling, setIsBackfilling] = useState(false)
  const [backfillProgress, setBackfillProgress] = useState<{
    current: number
    total: number
  } | null>(null)

  // Fetch corporate events from bc-event service
  const { data, error, isLoading, mutate } = useSwr(
    modalOpen ? corporateEventsKey(asset.id, fromDate, toDate) : null,
    modalOpen
      ? simpleFetcher(corporateEventsKey(asset.id, fromDate, toDate))
      : null,
  )

  // Fetch existing portfolio transactions for reconciliation
  const { data: portfolioTrnsData, mutate: mutateTrns } = useSwr(
    modalOpen ? eventKey(portfolioId, asset.id) : null,
    modalOpen ? simpleFetcher(eventKey(portfolioId, asset.id)) : null,
  )

  const portfolioTransactions: Transaction[] = portfolioTrnsData?.data || []

  const handleLoadEvents = async (): Promise<void> => {
    setIsLoadingEvents(true)
    setLoadError(null)
    setLoadSuccess(false)

    try {
      const response = await fetch(
        `/api/corporate-events/load/${portfolioId}/${toDate}`,
        { method: "POST" },
      )

      if (!response.ok) {
        const errorData = await response.json()
        setLoadError(errorData.message || "Failed to load events")
        return
      }

      setLoadSuccess(true)
      // Refresh the events list
      await mutate()
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load events")
    } finally {
      setIsLoadingEvents(false)
    }
  }

  const handleProcessEvent = async (
    eventId: string,
    payDate?: string,
  ): Promise<void> => {
    setProcessingEventId(eventId)
    setProcessError(null)
    setProcessSuccess(null)
    setEditingEventId(null)
    setOverridePayDate("")

    // Determine the effective pay date that will be used
    const event = events.find((e: CorporateEvent) => e.id === eventId)
    const effectivePayDate =
      payDate || (event ? calculateEffectivePayDate(event) : toDate)

    try {
      const url = payDate
        ? `/api/corporate-events/process/${eventId}?payDate=${payDate}`
        : `/api/corporate-events/process/${eventId}`
      const response = await fetch(url, { method: "POST" })

      if (!response.ok) {
        const errorData = await response.json()
        setProcessError(errorData.message || t("corporate.error.process"))
        return
      }

      setProcessSuccess(eventId)
      // Track which pay date was used for this event
      setProcessedPayDates((prev) => ({ ...prev, [eventId]: effectivePayDate }))
      // Refresh portfolio transactions to update reconciliation status
      await mutateTrns()
      // Clear success message after 5 seconds
      setTimeout(() => setProcessSuccess(null), 5000)
    } catch (err) {
      setProcessError(
        err instanceof Error ? err.message : t("corporate.error.process"),
      )
    } finally {
      setProcessingEventId(null)
    }
  }

  const handleEditPayDate = (event: CorporateEvent): void => {
    setEditingEventId(event.id)
    // Default to the calculated effective pay date or toDate if in the future
    const effectiveDate = calculateEffectivePayDate(event)
    setOverridePayDate(effectiveDate <= toDate ? effectiveDate : toDate)
  }

  const handleCancelEdit = (): void => {
    setEditingEventId(null)
    setOverridePayDate("")
  }

  const handleSavePayDate = async (eventId: string): Promise<void> => {
    if (!overridePayDate) return
    await handleProcessEvent(eventId, overridePayDate)
  }

  // Sort events by recordDate descending (most recent first)
  const events: CorporateEvent[] = (data?.data || []).sort(
    (a: CorporateEvent, b: CorporateEvent) =>
      new Date(b.recordDate).getTime() - new Date(a.recordDate).getTime(),
  )

  // Get events that are missing (not reconciled) and ready to process
  const getMissingProcessableEvents = (): CorporateEvent[] => {
    return events.filter(
      (event) =>
        !isEventReconciled(event, portfolioTransactions) &&
        canProcessEvent(event, toDate),
    )
  }

  const handleBackfill = async (): Promise<void> => {
    const missingEvents = getMissingProcessableEvents()
    if (missingEvents.length === 0) return

    setIsBackfilling(true)
    setProcessError(null)
    setBackfillProgress({ current: 0, total: missingEvents.length })

    for (let i = 0; i < missingEvents.length; i++) {
      const event = missingEvents[i]
      setBackfillProgress({ current: i + 1, total: missingEvents.length })

      try {
        const effectivePayDate = calculateEffectivePayDate(event)
        const response = await fetch(
          `/api/corporate-events/process/${event.id}`,
          { method: "POST" },
        )

        if (response.ok) {
          setProcessedPayDates((prev) => ({
            ...prev,
            [event.id]: effectivePayDate,
          }))
        }
      } catch {
        // Continue with next event even if one fails
      }
    }

    // Refresh portfolio transactions to update reconciliation status
    await mutateTrns()
    setIsBackfilling(false)
    setBackfillProgress(null)
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="fixed inset-0 bg-black opacity-50"
        onClick={onClose}
      ></div>
      <div className="bg-white rounded-lg shadow-lg w-full max-w-3xl mx-auto p-6 z-50 max-h-[80vh] overflow-hidden flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">
            {t("corporate.title")} - {asset.code}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="text-sm text-gray-600 mb-2">
          {t("corporate.dateRange", { from: fromDate, to: toDate })}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4 text-sm text-blue-800">
          <i className="fas fa-info-circle mr-2"></i>
          {t("corporate.info")}
        </div>

        <div className="overflow-y-auto flex-1">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <i className="fas fa-spinner fa-spin mr-2"></i>
              {t("loading")}
            </div>
          )}

          {error && (
            <div className="text-red-500 py-4">
              {t("corporate.error.retrieve")}
            </div>
          )}

          {!isLoading && !error && events.length === 0 && (
            <div className="text-gray-500 py-8 text-center">
              {t("corporate.noEvents")}
            </div>
          )}

          {!isLoading && !error && events.length > 0 && (
            <table className="min-w-full bg-white">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th
                    className="px-2 py-2 text-center"
                    title={t("corporate.reconciled.hint")}
                  >
                    <i className="fas fa-check-circle text-gray-400"></i>
                  </th>
                  <th className="px-4 py-2 text-left">{t("corporate.type")}</th>
                  <th className="px-4 py-2 text-left">
                    {t("corporate.recordDate")}
                  </th>
                  <th
                    className="px-4 py-2 text-left"
                    title={t("corporate.effectiveDate.hint")}
                  >
                    {t("corporate.effectiveDate")}
                    <i className="fas fa-info-circle ml-1 text-xs text-gray-400"></i>
                  </th>
                  <th className="px-4 py-2 text-right">
                    {t("corporate.rate")}
                  </th>
                  <th className="px-4 py-2 text-right">
                    {t("corporate.split")}
                  </th>
                  <th className="px-4 py-2 text-center">
                    {t("corporate.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {events.map((event: CorporateEvent) => {
                  const reconciled = isEventReconciled(
                    event,
                    portfolioTransactions,
                  )
                  return (
                    <tr
                      key={event.id}
                      className={`border-t hover:bg-gray-50 transition-colors ${
                        reconciled ? "bg-green-50" : ""
                      }`}
                    >
                      <td className="px-2 py-2 text-center">
                        {reconciled ? (
                          <i
                            className="fas fa-check-circle text-green-500"
                            title={t("corporate.reconciled")}
                          ></i>
                        ) : (
                          <i
                            className="fas fa-circle text-gray-300"
                            title={t("corporate.notReconciled")}
                          ></i>
                        )}
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
                        {event.trnType === "DIVI" ? (
                          editingEventId === event.id ? (
                            <input
                              type="date"
                              value={overridePayDate}
                              min={event.recordDate}
                              max={toDate}
                              onChange={(e) =>
                                setOverridePayDate(e.target.value)
                              }
                              className="text-sm border rounded px-2 py-1 w-32"
                              autoFocus
                            />
                          ) : (
                            <button
                              onClick={() => handleEditPayDate(event)}
                              className={`text-left hover:underline ${
                                canProcessEvent(event, toDate)
                                  ? "text-green-600"
                                  : "text-orange-500"
                              }`}
                              title={t("corporate.payDate.clickToEdit")}
                            >
                              {calculateEffectivePayDate(event)}
                              {!canProcessEvent(event, toDate) && (
                                <i className="fas fa-clock ml-1 text-xs"></i>
                              )}
                              <i className="fas fa-pencil-alt ml-1 text-xs opacity-50"></i>
                            </button>
                          )
                        ) : (
                          event.recordDate
                        )}
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
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {event.trnType === "SPLIT" ? (
                          <NumericFormat
                            value={event.split}
                            displayType={"text"}
                            decimalScale={4}
                            fixedDecimalScale={true}
                          />
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-2 text-center">
                        {editingEventId === event.id ? (
                          <div className="flex items-center gap-2 justify-center">
                            <button
                              onClick={() => handleSavePayDate(event.id)}
                              disabled={
                                processingEventId === event.id ||
                                !overridePayDate ||
                                overridePayDate < event.recordDate ||
                                overridePayDate > toDate
                              }
                              className="text-green-500 hover:text-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              title={t("corporate.saveAndProcess")}
                            >
                              {processingEventId === event.id ? (
                                <i className="fas fa-spinner fa-spin"></i>
                              ) : (
                                <i className="fas fa-save"></i>
                              )}
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              disabled={processingEventId === event.id}
                              className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
                              title={t("cancel")}
                            >
                              <i className="fas fa-times"></i>
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 justify-center">
                            <button
                              onClick={() => handleProcessEvent(event.id)}
                              disabled={
                                processingEventId === event.id ||
                                !canProcessEvent(event, toDate)
                              }
                              className={`disabled:opacity-50 disabled:cursor-not-allowed ${
                                canProcessEvent(event, toDate)
                                  ? "text-blue-500 hover:text-blue-700"
                                  : "text-gray-300"
                              }`}
                              title={
                                canProcessEvent(event, toDate)
                                  ? t("corporate.process")
                                  : t("corporate.payDate.pending")
                              }
                            >
                              {processingEventId === event.id ? (
                                <i className="fas fa-spinner fa-spin"></i>
                              ) : processSuccess === event.id ? (
                                <span
                                  className="flex items-center text-green-500"
                                  title={t(
                                    "corporate.transactionCreated.hint",
                                    {
                                      date: processedPayDates[event.id],
                                    },
                                  )}
                                >
                                  <i className="fas fa-check mr-1"></i>
                                  <span className="text-xs">
                                    {t("corporate.transactionCreated")}
                                  </span>
                                </span>
                              ) : processedPayDates[event.id] ? (
                                <span
                                  className="flex items-center text-gray-400"
                                  title={t(
                                    "corporate.transactionCreated.hint",
                                    {
                                      date: processedPayDates[event.id],
                                    },
                                  )}
                                >
                                  <i className="fas fa-check mr-1"></i>
                                  <span className="text-xs">
                                    {processedPayDates[event.id]}
                                  </span>
                                </span>
                              ) : (
                                <i className="fas fa-play"></i>
                              )}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex justify-between items-center mt-4 pt-4 border-t">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              onClick={handleLoadEvents}
              disabled={isLoadingEvents || isBackfilling}
            >
              {isLoadingEvents ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-2"></i>
                  {t("corporate.loading")}
                </>
              ) : (
                <>
                  <i className="fas fa-download mr-2"></i>
                  {t("corporate.loadEvents")}
                </>
              )}
            </button>
            <button
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              onClick={handleBackfill}
              disabled={
                isBackfilling ||
                isLoadingEvents ||
                getMissingProcessableEvents().length === 0
              }
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
                  {t("corporate.backfill")} (
                  {getMissingProcessableEvents().length})
                </>
              )}
            </button>
            {loadSuccess && (
              <span className="text-green-600 text-sm">
                <i className="fas fa-check mr-1"></i>
                {t("corporate.loadSuccess")}
              </span>
            )}
            {loadError && (
              <span className="text-red-500 text-sm">
                <i className="fas fa-exclamation-circle mr-1"></i>
                {loadError}
              </span>
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

export default CorporateActionsPopup
