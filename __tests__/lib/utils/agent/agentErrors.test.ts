import { describeAgentError } from "@utils/agent/agentErrors"

describe("describeAgentError", () => {
  it("tells the reader they hold none of the asset in that portfolio", () => {
    const copy = describeAgentError("not-held")

    expect(copy.code).toBe("not-held")
    expect(copy.tone).toBe("error")
    // Retrying the same holding cannot change the answer.
    expect(copy.retryable).toBe(false)
    expect(copy.message).toMatch(/don't hold any of this asset/i)
  })

  it("names an exhausted credit balance as an administration issue", () => {
    const copy = describeAgentError("provider-quota")

    expect(copy.code).toBe("provider-quota")
    expect(copy.tone).toBe("service")
    // Retrying cannot clear it — only a top-up can.
    expect(copy.retryable).toBe(false)
    expect(copy.title).toMatch(/paused/i)
    expect(copy.message).toMatch(/credit/i)
    expect(copy.message).toMatch(/top(ped)? up/i)
    // The user must not read this as their own mistake.
    expect(copy.message).toMatch(/not (a problem|an issue) with/i)
  })

  it("reads the code out of the proxy's JSON error body", () => {
    // createApiHandler turns svc-agent's AgentResponse.error into both
    // `error` and `message` (see responseWriter.handleErrors).
    const copy = describeAgentError({
      error: "provider-quota",
      message: "provider-quota",
      code: "Payment Required",
      path: "/api/agent/query",
    })

    expect(copy.code).toBe("provider-quota")
    expect(copy.tone).toBe("service")
  })

  it("reads the code out of an Error thrown by a fetch wrapper", () => {
    expect(describeAgentError(new Error("provider-quota")).code).toBe(
      "provider-quota",
    )
  })

  it("falls back to the HTTP status when the body carries no code", () => {
    // A 402 that lost its body still has to read as a billing problem
    // rather than "Sorry, an error occurred: HTTP 402".
    expect(describeAgentError(null, 402).code).toBe("provider-quota")
    expect(describeAgentError("HTTP 402", 402).tone).toBe("service")
    expect(describeAgentError(null, 429).code).toBe("provider-rate")
  })

  it("keeps rate limiting and timeouts retryable", () => {
    const rate = describeAgentError("provider-rate")
    expect(rate.tone).toBe("service")
    expect(rate.retryable).toBe(true)

    const timeout = describeAgentError("provider-timeout")
    expect(timeout.tone).toBe("error")
    expect(timeout.retryable).toBe(true)
  })

  it("explains an unconfigured provider as a deployment setting", () => {
    const copy = describeAgentError("no-llm")

    expect(copy.tone).toBe("service")
    expect(copy.retryable).toBe(false)
    expect(copy.message).toMatch(/configured/i)
  })

  it("treats an agent failure as a genuine error, not a service notice", () => {
    const copy = describeAgentError("agent-error")

    expect(copy.tone).toBe("error")
    expect(copy.message).toMatch(/again/i)
  })

  it("does not classify text that merely contains a code", () => {
    // Substring matching would read this as agent-error and replace the real
    // text with canned copy.
    const copy = describeAgentError("not-agent-error related failure")

    expect(copy.code).toBe("unknown")
    expect(copy.message).toContain("not-agent-error related failure")
  })

  it("reports the raw text it derived the copy from", () => {
    // Callers that record the failure alongside the copy use `detail`, so the
    // recorded value and the rendered copy come from one extraction.
    expect(describeAgentError(new Error("Network error")).detail).toBe(
      "Network error",
    )
    expect(describeAgentError({ error: "provider-quota" }).detail).toBe(
      "provider-quota",
    )
    expect(describeAgentError("HTTP 402", 402).detail).toBe("HTTP 402")
  })

  it("passes an unrecognised message through instead of swallowing it", () => {
    const copy = describeAgentError("ECONNREFUSED 127.0.0.1:9520")

    expect(copy.tone).toBe("error")
    expect(copy.code).toBe("unknown")
    expect(copy.message).toContain("ECONNREFUSED 127.0.0.1:9520")
  })

  it("survives an empty failure with something readable", () => {
    expect(describeAgentError(undefined).message).not.toHaveLength(0)
    expect(describeAgentError("").message).not.toHaveLength(0)
  })

  it("says the AI ran out of room to write, offers retry first, then narrowing", () => {
    // svc-agent emits this when a turn ends on finish_reason=length with no
    // answer text. On kauri (2026-09-25) that was the model's *output* budget
    // being spent on reasoning — the prompt was 27k of a 1M window — so
    // "too much data, ask a narrower question" was the wrong advice. A retry
    // is the first move; narrowing is the fallback when it keeps happening.
    const copy = describeAgentError("answer-truncated")

    expect(copy.code).toBe("answer-truncated")
    expect(copy.tone).toBe("error")
    expect(copy.retryable).toBe(true)
    expect(copy.title).not.toMatch(/too much data/i)
    expect(copy.message).toMatch(/retry|try again|second attempt/i)
    expect(copy.message).toMatch(/one (plan|phase|holding)|narrower|smaller/i)
  })

  it("says so plainly when the model finished without answering", () => {
    const copy = describeAgentError("empty-answer")

    expect(copy.code).toBe("empty-answer")
    expect(copy.tone).toBe("error")
    expect(copy.retryable).toBe(true)
    expect(copy.message).not.toHaveLength(0)
  })

  it("reads the new codes out of an SSE error payload", () => {
    // The streaming path delivers a bare code as the `error` event's data.
    expect(describeAgentError({ error: "answer-truncated" }).code).toBe(
      "answer-truncated",
    )
    expect(describeAgentError(new Error("empty-answer")).code).toBe(
      "empty-answer",
    )
  })
})

describe("describeAgentError: ai-quota", () => {
  it("says the reader has used this week's AI questions", () => {
    const copy = describeAgentError("ai-quota")

    expect(copy.code).toBe("ai-quota")
    expect(copy.tone).toBe("service")
    // Asking again cannot help until a turn frees up or the limit is raised.
    expect(copy.retryable).toBe(false)
    expect(copy.title).toMatch(/this week's AI questions/i)
  })

  it("reads ai-quota out of the 429 body /query returns, not provider-rate", () => {
    // svc-agent answers an exhausted quota with 429 — the same status as
    // provider rate limiting — so the code in the body must win.
    const copy = describeAgentError(
      {
        error: "ai-quota",
        message: "ai-quota",
        code: "Too Many Requests",
        path: "/api/agent/query",
      },
      429,
    )

    expect(copy.code).toBe("ai-quota")
  })

  it("reads ai-quota out of the SSE error payload", () => {
    expect(describeAgentError("ai-quota").code).toBe("ai-quota")
  })

  it("is not confused with the provider's own quota", () => {
    expect(describeAgentError("provider-quota").code).toBe("provider-quota")
  })
})

describe("describeAgentError: email-unverified", () => {
  it("asks the reader to confirm their email and points at cached reviews", () => {
    const copy = describeAgentError(
      {
        error: "email-unverified",
        message: "email-unverified",
        code: "Forbidden",
        path: "/api/agent/query",
      },
      403,
    )

    expect(copy.code).toBe("email-unverified")
    expect(copy.tone).toBe("service")
    expect(copy.retryable).toBe(false)
    expect(copy.title).toMatch(/confirm your email/i)
    expect(copy.message).toMatch(/Asset Reviews/)
  })
})

describe("describeAgentError: ai-disabled", () => {
  it("says an admin turned AI off for this account and is not retryable", () => {
    const copy = describeAgentError(
      {
        error: "ai-disabled",
        message: "ai-disabled",
        code: "Forbidden",
        path: "/api/agent/query",
      },
      403,
    )

    expect(copy.code).toBe("ai-disabled")
    expect(copy.tone).toBe("service")
    expect(copy.retryable).toBe(false)
    expect(copy.title).toMatch(/AI is turned off for your account/i)
    expect(copy.message).toMatch(/contact/i)
  })

  it("is not confused with the weekly quota", () => {
    expect(describeAgentError("ai-quota").code).toBe("ai-quota")
  })
})
