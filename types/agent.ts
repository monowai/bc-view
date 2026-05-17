export interface AgentQuery {
  query: string
  context?: Record<string, unknown>
  /** Caller-driven escalation to svc-agent's DEEP tier. Default false. */
  deepThink?: boolean
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
