import { refreshHoldingsSoon } from "./refreshHoldings"
import { refreshNetWorth } from "@lib/wealth/refreshNetWorth"
import {
  aggregatedHoldingsTodayKey,
  holdingByIdKey,
  holdingKey,
} from "@utils/api/client/holdings"

jest.mock("@lib/wealth/refreshNetWorth", () => ({ refreshNetWorth: jest.fn() }))

describe("refreshHoldingsSoon", () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => jest.useRealTimers())

  it("refetches every holdings view and net worth once the write has landed", () => {
    const mutate = jest.fn()
    refreshHoldingsSoon(mutate)
    expect(mutate).not.toHaveBeenCalled()
    jest.advanceTimersByTime(1500)
    expect(mutate).toHaveBeenCalledTimes(1)
    const matches = mutate.mock.calls[0][0] as (key: unknown) => boolean
    expect(matches(holdingKey("PF1", "today"))).toBe(true)
    expect(matches(holdingByIdKey("p1", "today"))).toBe(true)
    expect(matches(aggregatedHoldingsTodayKey)).toBe(true)
    expect(matches("/api/trns/t1")).toBe(false)
    expect(refreshNetWorth).toHaveBeenCalledTimes(1)
  })
})
