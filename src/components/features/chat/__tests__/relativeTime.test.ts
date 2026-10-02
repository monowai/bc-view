import { formatRelativeTime } from "../relativeTime"

describe("formatRelativeTime", () => {
  const now = new Date("2026-10-02T12:00:00Z")

  it.each([
    ["2026-10-02T11:59:30Z", "just now"],
    ["2026-10-02T11:55:00Z", "5m ago"],
    ["2026-10-02T09:00:00Z", "3h ago"],
    ["2026-09-30T12:00:00Z", "2d ago"],
  ])("describes %s as %s", (iso, expected) => {
    expect(formatRelativeTime(iso, now)).toBe(expected)
  })

  it("falls back to a short date beyond a week", () => {
    const iso = "2026-08-15T12:00:00Z"
    expect(formatRelativeTime(iso, now)).toBe(
      new Date(iso).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
      }),
    )
  })

  it("treats a future timestamp (clock skew) as just now", () => {
    expect(formatRelativeTime("2026-10-02T12:01:00Z", now)).toBe("just now")
  })

  it("returns an empty string for an unparseable timestamp", () => {
    expect(formatRelativeTime("not a date", now)).toBe("")
  })
})
