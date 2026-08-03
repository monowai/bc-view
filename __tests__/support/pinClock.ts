/**
 * Test helper: pin the clock to a fixed instant AND a fixed local UTC offset.
 *
 * `process.env.TZ` cannot be mutated reliably part-way through a jest run, so
 * the local calendar accessors are stubbed instead. That makes local-vs-UTC
 * date divergence deterministic regardless of the machine's real timezone —
 * a developer in Asia/Singapore and CI in UTC both see the same result.
 *
 * Call `jest.restoreAllMocks()` and `jest.useRealTimers()` when done.
 *
 * @param instantIso  The absolute instant, e.g. "2026-08-02T23:00:00Z".
 * @param utcOffsetHours  The local zone's offset from UTC, e.g. +8 for SGT.
 */
export const pinClock = (instantIso: string, utcOffsetHours: number): void => {
  const instant = new Date(instantIso)
  const local = new Date(instant.getTime() + utcOffsetHours * 3_600_000)

  jest.useFakeTimers().setSystemTime(instant)
  jest
    .spyOn(Date.prototype, "getFullYear")
    .mockReturnValue(local.getUTCFullYear())
  jest.spyOn(Date.prototype, "getMonth").mockReturnValue(local.getUTCMonth())
  jest.spyOn(Date.prototype, "getDate").mockReturnValue(local.getUTCDate())
}

export const unpinClock = (): void => {
  jest.restoreAllMocks()
  jest.useRealTimers()
}
