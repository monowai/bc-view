import React from "react"
import { render, screen, waitFor, within, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import useSwr from "swr"
import CorporateActionsPopup from "../CorporateActionsPopup"
import { makeAsset } from "@test-fixtures/asset"
import type { CorporateEvent } from "types/beancounter"

jest.mock("swr")
const mockUseSwr = useSwr as jest.MockedFunction<typeof useSwr>

const mockProcess = jest.fn()
jest.mock("@utils/api/client/corporateEvents", () => ({
  ...jest.requireActual("@utils/api/client/corporateEvents"),
  processCorporateEvent: (...a: unknown[]) => mockProcess(...a),
}))

const event = (over: Partial<CorporateEvent>): CorporateEvent =>
  ({
    assetId: "asset-aapl",
    source: "ALPHA",
    rate: 0.5,
    split: 1,
    ...over,
  }) as CorporateEvent

const events = [
  event({
    id: "e-ready",
    trnType: "DIVI",
    recordDate: "2024-01-15",
    payDate: "2024-02-01",
  }),
  event({
    id: "e-future",
    trnType: "DIVI",
    recordDate: "2024-06-10",
    payDate: "2024-06-28",
  }),
  event({
    id: "e-split",
    trnType: "SPLIT",
    recordDate: "2024-03-01",
    payDate: "2024-03-15",
    split: 4,
  }),
  event({
    id: "e-done",
    trnType: "DIVI",
    recordDate: "2023-09-01",
    payDate: "2023-09-20",
  }),
]

const existingTrns = [
  {
    id: "t1",
    trnType: "DIVI",
    tradeDate: "2023-09-20",
    callerRef: { batch: "e-done" },
  },
]

const mutateEvents = jest.fn()
const mutateTrns = jest.fn()

function wireSwr(eventData: CorporateEvent[] = events): void {
  mockUseSwr.mockImplementation(((key: string | null) => {
    if (key && key.includes("/trns/events/")) {
      return { data: { data: existingTrns }, mutate: mutateTrns }
    }
    return {
      data: { data: eventData },
      error: undefined,
      isLoading: false,
      mutate: mutateEvents,
    }
  }) as never)
}

function renderPopup(
  over: Partial<React.ComponentProps<typeof CorporateActionsPopup>> = {},
): void {
  render(
    <CorporateActionsPopup
      asset={makeAsset({ id: "asset-aapl", code: "AAPL" })}
      portfolioId="pf-1"
      fromDate="2023-01-01"
      toDate="2024-06-15"
      modalOpen
      onClose={jest.fn()}
      {...over}
    />,
  )
}

const rowOf = (recordDate: string): HTMLElement =>
  screen.getByText(recordDate).closest("tr") as HTMLElement

describe("CorporateActionsPopup actions", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    wireSwr()
    mockProcess.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
    jest.spyOn(console, "log").mockImplementation(() => {})
    jest.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it("marks reconciled events and offers processing only for those that are ready", () => {
    renderPopup()
    expect(
      within(rowOf("2023-09-01")).getByTitle("Transaction exists in portfolio"),
    ).toBeInTheDocument()
    expect(
      within(rowOf("2024-01-15")).getByTitle(
        "No matching transaction in portfolio",
      ),
    ).toBeInTheDocument()
    // dividend not yet payable cannot be processed
    expect(
      within(rowOf("2024-06-10")).getByTitle(
        "Pay date in future - click to edit",
      ),
    ).toBeDisabled()
    expect(
      within(rowOf("2024-03-01")).getByTitle(
        "Process event to create transaction",
      ),
    ).toBeEnabled()
  })

  it("processes an event, refreshes transactions and shows the dispatched state", async () => {
    const user = userEvent.setup()
    renderPopup()
    await user.click(
      within(rowOf("2024-01-15")).getByTitle(
        "Process event to create transaction",
      ),
    )
    expect(mockProcess).toHaveBeenCalledWith("e-ready", undefined)
    expect(await screen.findByText("Transaction dispatched")).toBeVisible()
    expect(mutateTrns).toHaveBeenCalled()
  })

  it("reverts the dispatched message to the pay date after a while", async () => {
    jest.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime })
    renderPopup()
    await user.click(
      within(rowOf("2024-01-15")).getByTitle(
        "Process event to create transaction",
      ),
    )
    expect(await screen.findByText("Transaction dispatched")).toBeVisible()
    act(() => {
      jest.advanceTimersByTime(5000)
    })
    expect(screen.queryByText("Transaction dispatched")).toBeNull()
    expect(within(rowOf("2024-01-15")).getAllByText("2024-02-02")).toHaveLength(
      2,
    )
  })

  it("shows the server message when processing fails", async () => {
    const user = userEvent.setup()
    mockProcess.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ message: "Already processed" }),
    })
    renderPopup()
    await user.click(
      within(rowOf("2024-03-01")).getByTitle(
        "Process event to create transaction",
      ),
    )
    expect(await screen.findByText("Already processed")).toBeVisible()
    expect(mutateTrns).not.toHaveBeenCalled()
  })

  it("shows an error when the process request itself throws", async () => {
    const user = userEvent.setup()
    mockProcess.mockRejectedValue(new Error("network down"))
    renderPopup()
    await user.click(
      within(rowOf("2024-03-01")).getByTitle(
        "Process event to create transaction",
      ),
    )
    expect(await screen.findByText("network down")).toBeVisible()
  })

  it("lets the user pick a transaction date for a dividend and process with it", async () => {
    const user = userEvent.setup()
    renderPopup()
    await user.click(
      within(rowOf("2024-01-15")).getByTitle("Click to set transaction date"),
    )
    const input = within(rowOf("2024-01-15")).getByDisplayValue("2024-02-02")
    expect(input).toHaveAttribute("type", "date")

    await user.click(
      within(rowOf("2024-01-15")).getByTitle(
        "Create transaction with this date",
      ),
    )
    expect(mockProcess).toHaveBeenCalledWith("e-ready", "2024-02-02")
    await waitFor(() => expect(mutateTrns).toHaveBeenCalled())
  })

  it("cancels an edit without processing", async () => {
    const user = userEvent.setup()
    renderPopup()
    await user.click(
      within(rowOf("2024-01-15")).getByTitle("Click to set transaction date"),
    )
    await user.click(within(rowOf("2024-01-15")).getByTitle("Cancel"))
    expect(mockProcess).not.toHaveBeenCalled()
    expect(
      within(rowOf("2024-01-15")).getByTitle("Click to set transaction date"),
    ).toBeVisible()
  })

  it("caps the suggested date at the end of the range for a not-yet-payable dividend", async () => {
    const user = userEvent.setup()
    renderPopup()
    await user.click(
      within(rowOf("2024-06-10")).getByTitle("Click to set transaction date"),
    )
    expect(
      within(rowOf("2024-06-10")).getByDisplayValue("2024-06-15"),
    ).toBeVisible()
  })

  it("edits the date of an existing reconciled transaction", async () => {
    const user = userEvent.setup()
    renderPopup()
    await user.click(
      within(rowOf("2023-09-01")).getByTitle("Click to edit transaction date"),
    )
    expect(
      within(rowOf("2023-09-01")).getByDisplayValue("2023-09-20"),
    ).toBeVisible()
  })

  it("backfills every missing, payable event and refreshes transactions", async () => {
    const user = userEvent.setup()
    renderPopup()
    // e-ready and e-split are payable and unreconciled; e-future and e-done are not
    const backfill = screen.getByRole("button", { name: /Backfill \(2\)/ })
    await user.click(backfill)
    await waitFor(() => expect(mutateTrns).toHaveBeenCalled())
    expect(mockProcess.mock.calls.map((c) => c[0]).sort()).toEqual([
      "e-ready",
      "e-split",
    ])
    expect(within(rowOf("2024-01-15")).getAllByText("2024-02-02")).toHaveLength(
      2,
    )
  })

  it("keeps backfilling when one event fails", async () => {
    const user = userEvent.setup()
    mockProcess.mockRejectedValueOnce(new Error("x"))
    renderPopup()
    await user.click(screen.getByRole("button", { name: /Backfill \(2\)/ }))
    await waitFor(() => expect(mockProcess).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(mutateTrns).toHaveBeenCalled())
  })

  it("disables backfill when nothing is missing", () => {
    wireSwr([events[3]])
    renderPopup()
    expect(
      screen.getByRole("button", { name: /Backfill \(0\)/ }),
    ).toBeDisabled()
  })

  it("hides events for positions closed before the record date", () => {
    renderPopup({ closedDate: "2023-12-31" })
    expect(screen.queryByText("2024-01-15")).toBeNull()
    expect(screen.getByText("2023-09-01")).toBeVisible()
  })

  describe("loading events from the provider", () => {
    let fetchMock: jest.Mock
    beforeEach(() => {
      fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 })
      global.fetch = fetchMock as never
    })

    it("requests every 15 days plus the end date, then refreshes", async () => {
      const user = userEvent.setup()
      renderPopup({ fromDate: "2024-05-01", toDate: "2024-06-15" })
      await user.click(screen.getByRole("button", { name: /Load Events/ }))
      expect(await screen.findByText("Events loaded")).toBeVisible()
      const urls = fetchMock.mock.calls.map((c) => c[0] as string)
      expect(urls.map((u) => u.match(/asAt=(.*)$/)![1])).toEqual([
        "2024-05-01",
        "2024-05-16",
        "2024-05-31",
        "2024-06-15",
      ])
      expect(fetchMock.mock.calls[0][1]).toEqual({ method: "POST" })
      expect(mutateEvents).toHaveBeenCalled()
    })

    it("reports the server's message when a single-date load fails", async () => {
      const user = userEvent.setup()
      fetchMock.mockResolvedValue({
        ok: false,
        status: 502,
        text: () =>
          Promise.resolve(JSON.stringify({ message: "Provider unavailable" })),
      })
      renderPopup({ fromDate: "2024-06-15", toDate: "2024-06-15" })
      await user.click(screen.getByRole("button", { name: /Load Events/ }))
      expect(await screen.findByText("Provider unavailable")).toBeVisible()
      expect(screen.queryByText("Events loaded")).toBeNull()
    })

    it("falls back to a status message when the failure body is not JSON", async () => {
      const user = userEvent.setup()
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve("<html>"),
      })
      renderPopup({ fromDate: "2024-06-15", toDate: "2024-06-15" })
      await user.click(screen.getByRole("button", { name: /Load Events/ }))
      expect(
        await screen.findByText("Failed to load events (500)"),
      ).toBeVisible()
    })

    it("shows the error when the request throws", async () => {
      const user = userEvent.setup()
      fetchMock.mockRejectedValue(new Error("offline"))
      renderPopup()
      await user.click(screen.getByRole("button", { name: /Load Events/ }))
      expect(await screen.findByText("offline")).toBeVisible()
    })
  })
})
