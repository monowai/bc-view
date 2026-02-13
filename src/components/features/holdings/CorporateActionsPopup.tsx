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
import DateInput from "@components/ui/DateInput"
import {
  calculateEffectivePayDate,
  canProcessEvent,
  getMatchingTransaction,
  getMissingProcessableEvents,
  filterEventsForOpenPosition,
  sortEventsByRecordDateDesc,
} from "@lib/corporate-events"
import Dialog from "@components/ui/Dialog"
import Spinner from "@components/ui/Spinner"
import Alert from "@components/ui/Alert"

interface CorporateActionsPopupProps {
  asset: Asset
  portfolioId: string
  fromDate: string
  toDate?: string // Optional - defaults to today if not provided
  closedDate?: string // Position closed date - events after this should be ignored
  modalOpen: boolean
  onClose: () => void
}

const CorporateActionsPopup: React.FC<CorporateActionsPopupProps> = ({
  asset,
  portfolioId,
  fromDate: fromDateProp,
  toDate: toDateProp,
  closedDate,
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

  // Calculate initial toDate
  const initialToDate = isValidDate(toDateProp) ? toDateProp! : today

  // Calculate initial fromDate (1 year before toDate, or use prop)
  const initialFromDate = (() => {
    if (isValidDate(fromDateProp)) return fromDateProp!
    const date = new Date(initialToDate)
    date.setFullYear(date.getFullYear() - 1)
    return date.toISOString().split("T")[0]
  })()

  // Editable date range state
  const [fromDate, setFromDate] = useState(initialFromDate)
  const [toDate, setToDate] = useState(initialToDate)

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
  const eventUrl = corporateEventsKey(asset.id, fromDate, toDate)
  console.log(
    `[CorporateActions] Fetching events for asset: ${asset.id} (${asset.code}), from: ${fromDate}, to: ${toDate}`,
  )
  console.log(`[CorporateActions] Event URL: ${eventUrl}`)

  const { data, error, isLoading, mutate } = useSwr(
    modalOpen ? eventUrl : null,
    modalOpen ? simpleFetcher(eventUrl) : null,
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

    console.log(
      `[CorporateActions] Loading events for asset: ${asset.id} (${asset.code}), range: ${fromDate} to ${toDate}`,
    )

    try {
      // Backend loads events within ±10 days of the specified date.
      // To cover the full date range, we iterate at 15-day intervals.
      const startDate = new Date(fromDate)
      const endDate = new Date(toDate)
      const intervalDays = 15

      const datesToLoad: string[] = []
      for (
        let currentDate = new Date(startDate);
        currentDate <= endDate;
        currentDate.setDate(currentDate.getDate() + intervalDays)
      ) {
        datesToLoad.push(currentDate.toISOString().split("T")[0])
      }

      // Always include the end date to catch events near the end of range
      const endDateStr = endDate.toISOString().split("T")[0]
      if (!datesToLoad.includes(endDateStr)) {
        datesToLoad.push(endDateStr)
      }

      console.log(
        `[CorporateActions] Loading events for ${datesToLoad.length} date points: ${datesToLoad.join(", ")}`,
      )

      let hasError = false
      let lastError = ""

      for (const dateStr of datesToLoad) {
        const loadUrl = `/api/corporate-events/load/asset/${asset.id}?asAt=${dateStr}`
        console.log(`[CorporateActions] Load URL: ${loadUrl}`)
        const response = await fetch(loadUrl, { method: "POST" })
        console.log(
          `[CorporateActions] Response status for ${dateStr}: ${response.status}`,
        )

        if (!response.ok) {
          hasError = true
          const errorText = await response.text()
          console.error(
            `[CorporateActions] Load failed for ${dateStr}: ${errorText}`,
          )
          try {
            const errorData = JSON.parse(errorText)
            lastError =
              errorData.message ||
              errorData.detail ||
              `Failed to load events (${response.status})`
          } catch {
            lastError = `Failed to load events (${response.status})`
          }
          // Continue loading other dates even if one fails
        }
      }

      if (hasError && datesToLoad.length === 1) {
        // Only show error if all loads failed
        setLoadError(lastError)
        return
      }

      setLoadSuccess(true)
      console.log(`[CorporateActions] Load succeeded, refreshing events list`)
      // Refresh the events list
      await mutate()
      console.log(`[CorporateActions] Events list refreshed`)
    } catch (err) {
      console.error(`[CorporateActions] Load error:`, err)
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
  const events: CorporateEvent[] = sortEventsByRecordDateDesc(data?.data || [])

  // Get events that are missing (not reconciled) and ready to process
  const missingEvents = getMissingProcessableEvents(
    events,
    portfolioTransactions,
    toDate,
    closedDate,
  )

  // Filter events for display (exclude those for closed positions)
  const displayEvents = filterEventsForOpenPosition(events, closedDate)

  const handleBackfill = async (): Promise<void> => {
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
    <Dialog
      title={`${t("corporate.title")} - ${asset.code}`}
      onClose={onClose}
      maxWidth="xl"
      scrollable
      footer={
        <>
          <div className="flex items-center gap-2 flex-wrap flex-1">
            <button
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              onClick={handleLoadEvents}
              disabled={isLoadingEvents || isBackfilling}
            >
              {isLoadingEvents ? (
                <Spinner label={t("corporate.loading")} />
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
                isBackfilling || isLoadingEvents || missingEvents.length === 0
              }
              title={t("corporate.backfill.hint")}
            >
              {isBackfilling ? (
                <Spinner
                  label={
                    backfillProgress
                      ? `${backfillProgress.current}/${backfillProgress.total}`
                      : t("corporate.loading")
                  }
                />
              ) : (
                <>
                  <i className="fas fa-forward mr-2"></i>
                  {t("corporate.backfill")} ({missingEvents.length})
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
          <Dialog.CancelButton onClick={onClose} label={t("cancel")} />
        </>
      }
    >
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span>{t("corporate.from", "From")}:</span>
        <DateInput
          value={fromDate}
          onChange={setFromDate}
          max={toDate}
          className="text-sm border rounded px-2 py-1 w-36"
        />
        <span>{t("corporate.to", "To")}:</span>
        <DateInput
          value={toDate}
          onChange={setToDate}
          min={fromDate}
          max={today}
          className="text-sm border rounded px-2 py-1 w-36"
        />
      </div>

      <Alert variant="info">
        <i className="fas fa-info-circle mr-2"></i>
        {t("corporate.info")}
      </Alert>

      <div className="overflow-y-auto flex-1">
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <Spinner label={t("loading")} />
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
                <th
                  className="px-4 py-2 text-left"
                  title={t("corporate.trnDate.hint")}
                >
                  {t("corporate.trnDate")}
                </th>
                <th className="px-4 py-2 text-right">{t("corporate.rate")}</th>
                <th className="px-4 py-2 text-right">{t("corporate.split")}</th>
                <th className="px-4 py-2 text-center">
                  {t("corporate.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {displayEvents.map((event: CorporateEvent) => {
                const matchingTrn = getMatchingTransaction(
                  event,
                  portfolioTransactions,
                )
                const reconciled = matchingTrn !== undefined
                const effectiveDate = calculateEffectivePayDate(event)
                return (
                  <tr
                    key={event.id}
                    className={`border-t hover:bg-gray-50 transition-colors text-sm ${
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
                      <span
                        className={
                          canProcessEvent(event, toDate)
                            ? "text-green-600"
                            : "text-orange-500"
                        }
                        title={t("corporate.effectiveDate.hint")}
                      >
                        {effectiveDate}
                        {!canProcessEvent(event, toDate) && (
                          <i className="fas fa-clock ml-1 text-xs"></i>
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      {event.trnType === "DIVI" ? (
                        editingEventId === event.id ? (
                          <DateInput
                            value={overridePayDate}
                            min={event.recordDate}
                            max={toDate}
                            onChange={setOverridePayDate}
                            className="text-sm border rounded px-2 py-1 w-32"
                            autoFocus
                          />
                        ) : reconciled && matchingTrn ? (
                          <button
                            onClick={() => {
                              setEditingEventId(event.id)
                              setOverridePayDate(matchingTrn.tradeDate)
                            }}
                            className="text-left text-green-600 hover:underline"
                            title={t("corporate.trnDate.clickToEdit")}
                          >
                            {matchingTrn.tradeDate}
                            <i className="fas fa-pencil-alt ml-1 text-xs opacity-50"></i>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleEditPayDate(event)}
                            className="text-left text-gray-500 hover:text-blue-600 hover:underline"
                            title={t("corporate.trnDate.clickToSet")}
                          >
                            <i className="fas fa-pencil-alt text-xs"></i>
                          </button>
                        )
                      ) : (
                        <span className="text-gray-400">-</span>
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
                                title={t("corporate.transactionCreated.hint", {
                                  date: processedPayDates[event.id],
                                })}
                              >
                                <i className="fas fa-check mr-1"></i>
                                <span className="text-xs">
                                  {t("corporate.transactionCreated")}
                                </span>
                              </span>
                            ) : processedPayDates[event.id] ? (
                              <span
                                className="flex items-center text-gray-400"
                                title={t("corporate.transactionCreated.hint", {
                                  date: processedPayDates[event.id],
                                })}
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
    </Dialog>
  )
}

export default CorporateActionsPopup
