/**
 * Clock helpers for tests that depend on "today".
 *
 * Jest's timezone is whatever the machine runs in, so a test cannot pick a
 * zone. Instead it pins the clock to instants built from local fields either
 * side of local midnight: in any zone other than UTC, one of them falls on a
 * different UTC calendar date, so code that reads the UTC date fails there.
 */

/** [hour, minute] just after and just before local midnight. */
export const LOCAL_MIDNIGHT_EDGES: ReadonlyArray<[number, number]> = [
  [0, 30],
  [23, 30],
]

/** Pins only `Date` to `now`; timers, microtasks and animation frames stay real. */
export function pinDate(now: Date): void {
  jest.useFakeTimers({
    now,
    doNotFake: [
      "setTimeout",
      "clearTimeout",
      "setInterval",
      "clearInterval",
      "setImmediate",
      "clearImmediate",
      "nextTick",
      "queueMicrotask",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "requestIdleCallback",
      "cancelIdleCallback",
      "performance",
      "hrtime",
    ],
  })
}
