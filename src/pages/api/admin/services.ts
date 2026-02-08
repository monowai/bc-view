import { auth0 } from "@lib/auth0"
import { fetchError } from "@utils/api/responseWriter"
import {
  getDataActuatorUrl,
  getPositionActuatorUrl,
  getEventActuatorUrl,
  getRetireActuatorUrl,
  getRebalanceActuatorUrl,
} from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

interface ServiceHealth {
  status: string
  components?: Record<string, { status: string }>
}

interface ServiceInfo {
  git?: {
    branch?: string
    commit?: {
      id?: string
      time?: string
    }
  }
  build?: {
    version?: string
    artifact?: string
    name?: string
    time?: string
  }
}

interface ServiceStatus {
  name: string
  url: string
  health: ServiceHealth | null
  info: ServiceInfo | null
  error: string | null
  responseTimeMs: number
}

interface ServicesResponse {
  services: ServiceStatus[]
  timestamp: string
}

async function fetchServiceStatus(
  name: string,
  baseUrl: string,
  token: string,
): Promise<ServiceStatus> {
  const startTime = Date.now()
  const result: ServiceStatus = {
    name,
    url: baseUrl,
    health: null,
    info: null,
    error: null,
    responseTimeMs: 0,
  }

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  }

  try {
    // Fetch health endpoint (typically public, no auth required)
    const healthResponse = await fetch(`${baseUrl}/actuator/health`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    })
    // Parse JSON body for both 200 and 503 (DOWN status returns 503 with valid JSON)
    if (healthResponse.ok || healthResponse.status === 503) {
      result.health = await healthResponse.json()
    } else {
      result.health = { status: `HTTP ${healthResponse.status}` }
    }
  } catch (e) {
    result.health = { status: "UNREACHABLE" }
    result.error = e instanceof Error ? e.message : "Unknown error"
  }

  try {
    // Fetch info endpoint (requires auth)
    const infoResponse = await fetch(`${baseUrl}/actuator/info`, {
      headers: authHeaders,
      signal: AbortSignal.timeout(5000),
    })
    if (infoResponse.ok) {
      result.info = await infoResponse.json()
    }
  } catch {
    // Info endpoint failure is not critical
  }

  result.responseTimeMs = Date.now() - startTime
  return result
}

/**
 * GET /api/admin/services
 * Returns health and version information for all backend services.
 * Admin-only endpoint.
 */
export default async function servicesHandler(
  req: NextApiRequest,
  res: NextApiResponse<ServicesResponse | { error: string }>,
): Promise<void> {
  try {
    const session = await auth0.getSession(req)
    if (!session) {
      res.status(401).json({ error: "Not authenticated" })
      return
    }

    const { method } = req

    if (method?.toUpperCase() !== "GET") {
      res.setHeader("Allow", ["GET"])
      res.status(405).end(`Method ${method} Not Allowed`)
      return
    }

    const { token: accessToken } = await auth0.getAccessToken(req, res)
    if (!accessToken) {
      res.status(401).json({ error: "Unauthorized" })
      return
    }

    // Define services to check (using actuator URLs)
    const services = [
      { name: "bc-data", url: getDataActuatorUrl() },
      { name: "bc-position", url: getPositionActuatorUrl() },
      { name: "bc-event", url: getEventActuatorUrl() },
      { name: "bc-retire", url: getRetireActuatorUrl() },
      { name: "bc-rebalance", url: getRebalanceActuatorUrl() },
    ]

    // Fetch all service statuses in parallel
    const statuses = await Promise.all(
      services.map((s) => fetchServiceStatus(s.name, s.url, accessToken)),
    )

    res.status(200).json({
      services: statuses,
      timestamp: new Date().toISOString(),
    })
  } catch (error: unknown) {
    fetchError(req, res, error)
  }
}
