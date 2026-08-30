/**
 * Single source of user-facing copy for svc-agent failures.
 *
 * svc-agent classifies every LLM failure into a stable opaque code
 * (`AgentController.classifyError`) and returns it as `AgentResponse.error` on
 * `/agent/query` and as the `event: error` payload on `/agent/query/stream`.
 * The code is a contract; the wording below is UI copy and may evolve.
 *
 * The distinction that matters to a reader is *whose problem it is*. An
 * exhausted credit balance on the AI provider account is an administration
 * state — nothing the user typed caused it and nothing they can do will clear
 * it — so it is toned as a service notice rather than dressed up as a failure
 * of their request.
 */

/** `service` = the AI backend is unavailable for an operational reason. */
export type AgentErrorTone = "error" | "service"

export interface AgentErrorCopy {
  /** The svc-agent code, or `"unknown"` when nothing recognisable was found. */
  code: string
  tone: AgentErrorTone
  title: string
  message: string
  /** false when trying again cannot help — someone has to act first. */
  retryable: boolean
}

const CODES = [
  "provider-quota",
  "provider-rate",
  "provider-timeout",
  "no-llm",
  "agent-error",
] as const

const COPY: Record<(typeof CODES)[number], Omit<AgentErrorCopy, "code">> = {
  "provider-quota": {
    tone: "service",
    title: "AI features are paused",
    message:
      "The AI provider account has run out of credit, so this can't run right now. " +
      "That's a service administration issue at our end — it is not a problem with " +
      "your data, your portfolio, or anything you did. The site owner needs to top up " +
      "the balance; everything else in Beancounter keeps working in the meantime.",
    retryable: false,
  },
  "provider-rate": {
    tone: "service",
    title: "The AI service is busy",
    message:
      "The AI provider is rate-limiting requests right now. Wait a few seconds and try again.",
    retryable: true,
  },
  "provider-timeout": {
    tone: "error",
    title: "The AI took too long",
    message:
      "The AI provider didn't respond in time. Heavy questions sometimes need a second attempt.",
    retryable: true,
  },
  "no-llm": {
    tone: "service",
    title: "AI features are switched off",
    message:
      "No AI provider is configured for this environment, so AI features can't run. " +
      "That's a deployment setting the site owner controls — nothing to do with your account or data.",
    retryable: false,
  },
  "agent-error": {
    tone: "error",
    title: "The AI request failed",
    message:
      "The agent couldn't process this request. Try again, or simplify the question.",
    retryable: true,
  },
}

/** HTTP statuses svc-agent uses for a classified provider failure. */
const STATUS_CODES: Record<number, (typeof CODES)[number]> = {
  402: "provider-quota",
  429: "provider-rate",
  504: "provider-timeout",
}

/**
 * Pull whatever text a failure carries. Handles the several shapes an agent
 * error arrives in: a bare SSE code, an `Error` thrown by a fetch wrapper, and
 * the JSON body `createApiHandler` writes (`{error, message, code, path}`).
 */
function textOf(raw: unknown): string {
  if (raw == null) return ""
  if (typeof raw === "string") {
    const trimmed = raw.trim()
    if (trimmed.startsWith("{")) {
      try {
        return textOf(JSON.parse(trimmed))
      } catch {
        return trimmed
      }
    }
    return trimmed
  }
  if (raw instanceof Error) return raw.message
  if (typeof raw === "object") {
    const body = raw as Record<string, unknown>
    for (const key of ["error", "code", "message", "detail"]) {
      const value = body[key]
      if (typeof value === "string" && value.length > 0) {
        const found = CODES.find((code) => value.includes(code))
        if (found) return found
      }
    }
    for (const key of ["error", "message", "detail", "code"]) {
      const value = body[key]
      if (typeof value === "string" && value.length > 0) return value
    }
    return ""
  }
  return String(raw)
}

/** Status carried on the failure itself, when the thrower attached one. */
function statusOf(raw: unknown): number | undefined {
  if (raw && typeof raw === "object" && "status" in raw) {
    const status = (raw as { status?: unknown }).status
    if (typeof status === "number") return status
  }
  return undefined
}

/**
 * Turn any agent failure into copy the reader can act on.
 *
 * @param raw       code, `Error`, or error body returned by the proxy route
 * @param httpStatus response status, used when the body arrived without a code
 */
export function describeAgentError(
  raw: unknown,
  httpStatus?: number,
): AgentErrorCopy {
  const text = textOf(raw)
  const matched = CODES.find((code) => text.includes(code))
  const status = httpStatus ?? statusOf(raw)
  const code = matched ?? (status ? STATUS_CODES[status] : undefined)

  if (code) return { code, ...COPY[code] }

  return {
    code: "unknown",
    tone: "error",
    title: "Something went wrong",
    message: text
      ? `Sorry, an error occurred: ${text}`
      : "Sorry, an error occurred. Please try again.",
    retryable: true,
  }
}
