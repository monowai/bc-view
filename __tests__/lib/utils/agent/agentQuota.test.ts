import { quotaRemainingText, quotaResetText } from "@utils/agent/agentQuota"
import { makeAgentQuota } from "@test-fixtures/beancounter"

describe("quotaRemainingText", () => {
  it("reports what the server says is left of the weekly limit", () => {
    expect(
      quotaRemainingText(makeAgentQuota({ limit: 10, used: 3, remaining: 7 })),
    ).toBe("7 of 10 AI questions left this week")
  })

  it("uses the server's remaining, never limit minus used", () => {
    // remaining is clamped server-side; a lowered limit can leave used > limit.
    expect(
      quotaRemainingText(makeAgentQuota({ limit: 2, used: 5, remaining: 0 })),
    ).toBe("0 of 2 AI questions left this week")
  })

  it("asks a user whose email is unconfirmed to confirm it", () => {
    expect(quotaRemainingText(makeAgentQuota({ verified: false }))).toBe(
      "Confirm your email address to ask the AI",
    )
  })

  it("says nothing for an unlimited user", () => {
    expect(quotaRemainingText(makeAgentQuota({ unlimited: true }))).toBeNull()
  })

  it("says AI is off when an admin has set the limit to zero", () => {
    expect(
      quotaRemainingText(
        makeAgentQuota({ override: true, limit: 0, used: 0, remaining: 0 }),
      ),
    ).toBe("AI is turned off for your account")
  })

  it("asks an unverified user to confirm their email before the disabled note", () => {
    expect(
      quotaRemainingText(
        makeAgentQuota({ override: true, limit: 0, verified: false }),
      ),
    ).toBe("Confirm your email address to ask the AI")
  })

  it("does not call a default-limit user with zero left disabled", () => {
    expect(
      quotaRemainingText(
        makeAgentQuota({ override: false, limit: 10, remaining: 0 }),
      ),
    ).toBe("0 of 10 AI questions left this week")
  })
})

describe("quotaResetText", () => {
  it("formats when the next question frees up, in the reader's zone", () => {
    const text = quotaResetText("2026-10-29T12:00:00Z", "en-GB", "UTC")

    expect(text).toMatch(/^The next one frees up/)
    expect(text).toContain("29 Oct")
    expect(text).toContain("12:00")
  })

  it("is null when nothing is counted", () => {
    expect(quotaResetText(null)).toBeNull()
  })

  it("is null for an unparseable instant", () => {
    expect(quotaResetText("not-a-date")).toBeNull()
  })
})
