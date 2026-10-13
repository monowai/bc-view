import { fetchError } from "@utils/api/responseWriter"
import {
  getDataActuatorUrl,
  getPositionActuatorUrl,
  getEventActuatorUrl,
  getRetireActuatorUrl,
  getRebalanceActuatorUrl,
  getWaharoaUrl,
  getWaharoaPublicUrl,
} from "@utils/api/bcConfig"
import { requireAdmin } from "@utils/api/requireAdmin"
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
  /** Browser-reachable URL when it differs from the probed one. */
  link?: string
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

interface LiteLlmReadiness {
  status?: string
  db?: string
  litellm_version?: string
}

/**
 * waharoa is LiteLLM, not Spring: no actuator. /health/readiness is
 * unauthenticated and answers {"status":"healthy","db":"connected",
 * "litellm_version":"x.y.z"}; anything else is DOWN.
 */
async function fetchWaharoaStatus(
  baseUrl: string,
  link: string | undefined,
): Promise<ServiceStatus> {
  const startTime = Date.now()
  const result: ServiceStatus = {
    name: "waharoa",
    url: baseUrl,
    link,
    health: null,
    info: null,
    error: null,
    responseTimeMs: 0,
  }

  try {
    const response = await fetch(`${baseUrl}/health/readiness`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
    })
    const body = (await response.json()) as LiteLlmReadiness
    const healthy = response.ok && body.status === "healthy"
    result.health = {
      status: healthy ? "UP" : "DOWN",
      components: body.db
        ? { db: { status: body.db === "connected" ? "UP" : "DOWN" } }
        : undefined,
    }
    if (body.litellm_version) {
      result.info = {
        build: { version: body.litellm_version, name: "litellm" },
      }
    }
  } catch (e) {
    result.health = { status: "UNREACHABLE" }
    result.error = e instanceof Error ? e.message : "Unknown error"
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
    const { method } = req
    if (method?.toUpperCase() !== "GET") {
      res.setHeader("Allow", ["GET"])
      res.status(405).end(`Method ${method} Not Allowed`)
      return
    }

    const guard = await requireAdmin(req, res)
    if (!guard.ok) return
    const accessToken = guard.token!

    // Define services to check (using actuator URLs)
    const services = [
      { name: "bc-data", url: getDataActuatorUrl() },
      { name: "bc-position", url: getPositionActuatorUrl() },
      { name: "bc-event", url: getEventActuatorUrl() },
      { name: "bc-retire", url: getRetireActuatorUrl() },
      { name: "bc-rebalance", url: getRebalanceActuatorUrl() },
    ]

    // Fetch all service statuses in parallel
    const probes = services.map((s) =>
      fetchServiceStatus(s.name, s.url, accessToken),
    )
    const waharoaUrl = getWaharoaUrl()
    if (waharoaUrl) {
      probes.push(fetchWaharoaStatus(waharoaUrl, getWaharoaPublicUrl()))
    }
    const statuses = await Promise.all(probes)

    res.status(200).json({
      services: statuses,
      timestamp: new Date().toISOString(),
    })
  } catch (error: unknown) {
    fetchError(req, res, error)
  }
}
