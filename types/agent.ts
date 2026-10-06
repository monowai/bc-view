export interface ChatTurn {
  role: "user" | "assistant"
  content: string
}

export interface AgentQuery {
  query: string
  context?: Record<string, unknown>
  /** Caller-driven escalation to svc-agent's DEEP tier. Default false. */
  deepThink?: boolean
  /**
   * Prior conversation turns, oldest first, so the model can see its own
   * previous question when the user replies to it. Caller-supplied and
   * scoped to this request only — no server-side persistence. svc-agent
   * truncates to the trailing 6 turns regardless of length.
   */
  history?: ChatTurn[]
  /**
   * Persisted conversation to continue. When present svc-agent ignores
   * `history`, replays its stored turns and records this exchange.
   */
  conversationId?: string
  /**
   * Display label for the user turn (see `ChatMessage.label`). Stored with
   * the turn when `conversationId` is set, and titles a new conversation.
   */
  label?: string
}

/** A persisted svc-agent chat conversation, as listed. Timestamps are ISO-8601. */
export interface ConversationSummary {
  id: string
  title: string
  createdAt: string
  updatedAt: string
}

/**
 * One stored turn. A failed answer is stored with `content: ""` and `error`
 * holding the svc-agent code (e.g. `provider-rate`).
 */
export interface ConversationTurn {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
  error: string | null
  deepThink: boolean
  /**
   * Display label of a user turn sent with one (a Quick Analysis), shown in
   * place of `content` — the canned prompt the model was asked.
   */
  label: string | null
}

export interface ConversationDetail extends ConversationSummary {
  messages: ConversationTurn[]
  /**
   * True while svc-agent is still generating the answer to the last user
   * turn — the browser may have dropped the stream, the server carries on.
   * False once the assistant turn (content, or `error`) has been saved. False
   * with a trailing `user` turn means the answer was lost (server restart).
   */
  pending: boolean
}

export interface AgentResponse {
  query: string
  response: string
  timestamp: string
  error: string | null
}

export interface ServiceStatus {
  name: string
  status: string
  error: string | null
}

export interface AgentHealthResponse {
  overallStatus: string
  summary: string
  services: ServiceStatus[]
  timestamp: string
}

export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string
  error?: string | null
  /** True when the user message was sent with the deep-think toggle on. */
  deepThink?: boolean
  /**
   * Shown in place of `content` on a user message whose content is a long
   * canned prompt (a Quick Analysis request). `content` is still what is sent
   * and replayed as history.
   */
  label?: string
}
