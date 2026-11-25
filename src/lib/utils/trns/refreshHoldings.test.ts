import { refreshHoldingsSoon } from "./refreshHoldings"
import { refreshNetWorth } from "@lib/wealth/refreshNetWorth"
import { holdingKey } from "@utils/api/fetchHelper"
import { aggregatedHoldingsTodayKey } from "@utils/api/client/holdings"

jest.mock("@lib/wealth/refreshNetWorth", () => ({ refreshNetWorth: jest.fn() }))

describe("refreshHoldingsSoon", () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it("refetches the portfolio, the aggregate and net worth once the write has landed", () => {
    const mutate = jest.fn()
    refreshHoldingsSoon(mutate, "PF1")
    expect(mutate).not.toHaveBeenCalled()
    jest.advanceTimersByTime(1500)
    expect(mutate.mock.calls.map((c) => c[0])).toEqual([
      holdingKey("PF1", "today"),
      aggregatedHoldingsTodayKey,
    ])
    expect(refreshNetWorth).toHaveBeenCalledTimes(1)
  })
})
