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
}
