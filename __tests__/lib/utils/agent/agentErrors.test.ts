import { describeAgentError } from "@utils/agent/agentErrors"

describe("describeAgentError", () => {
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
})
