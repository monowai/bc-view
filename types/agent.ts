export interface AgentQuery {
  query: string
  context?: Record<string, unknown>
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
}
