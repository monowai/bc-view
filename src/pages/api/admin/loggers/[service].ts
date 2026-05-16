import { auth0 } from "@lib/auth0"
import { fetchError } from "@utils/api/responseWriter"
import {
  getDataActuatorUrl,
  getPositionActuatorUrl,
  getEventActuatorUrl,
  getRetireActuatorUrl,
  getRebalanceActuatorUrl,
  getAgentActuatorUrl,
} from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

const ACTUATOR_URLS: Record<string, () => string> = {
  "bc-data": getDataActuatorUrl,
  "bc-position": getPositionActuatorUrl,
  "bc-event": getEventActuatorUrl,
  "bc-retire": getRetireActuatorUrl,
  "bc-rebalance": getRebalanceActuatorUrl,
  "bc-agent": getAgentActuatorUrl,
}

/**
 * GET  /api/admin/loggers/{service}              → list loggers
 * POST /api/admin/loggers/{service}              → set level
 *      body: { logger: string, configuredLevel: string | null }
 *
 * Proxies to {service}/actuator/loggers using the caller's access
 * token, which jar-auth accepts on /actuator/** with the
 * `beancounter:admin` scope.
 */
export default async function loggersHandler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  try {
    const session = await auth0.getSession(req)
    if (!session) {
      res.status(401).json({ error: "Not authenticated" })
      return
    }

    const service = Array.isArray(req.query.service)
      ? req.query.service[0]
      : req.query.service
    if (!service || !ACTUATOR_URLS[service]) {
      res.status(400).json({ error: "Unknown service" })
      return
    }

    const { token } = await auth0.getAccessToken(req, res)
    if (!token) {
      res.status(401).json({ error: "Unauthorized" })
      return
    }

    const base = ACTUATOR_URLS[service]()

    if (req.method === "GET") {
      const upstream = await fetch(`${base}/actuator/loggers`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(5000),
      })
      const body = await upstream.text()
      res
        .status(upstream.status)
        .setHeader("Content-Type", "application/json")
        .send(body)
      return
    }

    if (req.method === "POST") {
      const { logger, configuredLevel } = req.body ?? {}
      if (!logger || typeof logger !== "string") {
        res.status(400).json({ error: "logger required" })
        return
      }
      const encodedLogger = encodeURIComponent(logger)
      const upstream = await fetch(
        `${base}/actuator/loggers/${encodedLogger}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ configuredLevel }),
          signal: AbortSignal.timeout(5000),
        },
      )
      res.status(upstream.status).end()
      return
    }

    res.setHeader("Allow", ["GET", "POST"])
    res.status(405).end(`Method ${req.method} Not Allowed`)
  } catch (error: unknown) {
    fetchError(req, res, error)
  }
}
