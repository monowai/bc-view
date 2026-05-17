import { fetchError } from "@utils/api/responseWriter"
import { getDataActuatorUrl } from "@utils/api/bcConfig"
import { requireAdmin } from "@utils/api/requireAdmin"
import { NextApiRequest, NextApiResponse } from "next"

interface MicrometerMeasurement {
  statistic: string
  value: number
}

interface MicrometerMetric {
  name: string
  measurements: MicrometerMeasurement[]
  availableTags?: { tag: string; values: string[] }[]
}

interface EntityCount {
  entity: string
  count: number
}

interface EntityCountsResponse {
  service: string
  counts: EntityCount[]
  breakdowns: Record<string, EntityCount[]>
  fetchedAt: string
}

async function fetchMetric(
  baseUrl: string,
  name: string,
  query: string,
  token: string,
): Promise<MicrometerMetric | null> {
  const url = `${baseUrl}/actuator/metrics/${name}${query}`
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(5000),
  })
  if (!response.ok) return null
  return (await response.json()) as MicrometerMetric
}

function valueOf(metric: MicrometerMetric | null): number {
  if (!metric) return 0
  return metric.measurements.find((m) => m.statistic === "VALUE")?.value ?? 0
}

/**
 * GET /api/admin/metrics/entity-counts
 * Returns svc-data's `beancounter.entity.count` gauge values keyed by entity,
 * plus tagged breakdown gauges (asset by market, transaction by type, etc).
 */
export default async function entityCountsHandler(
  req: NextApiRequest,
  res: NextApiResponse<EntityCountsResponse | { error: string }>,
): Promise<void> {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", ["GET"])
      res.status(405).end(`Method ${req.method} Not Allowed`)
      return
    }

    const guard = await requireAdmin(req, res)
    if (!guard.ok) return
    const token = guard.token!

    const base = getDataActuatorUrl()

    // First call returns availableTags so we know which entities exist.
    // Fail fast if the root call fails — partial data masks auth/actuator outages.
    const root = await fetchMetric(base, "beancounter.entity.count", "", token)
    if (!root) {
      res
        .status(502)
        .json({ error: "Upstream actuator unreachable or unauthorized" })
      return
    }
    const entityTag = root.availableTags?.find((t) => t.tag === "entity")
    const entities = entityTag?.values ?? []

    const counts: EntityCount[] = await Promise.all(
      entities.map(async (entity) => {
        const m = await fetchMetric(
          base,
          "beancounter.entity.count",
          `?tag=entity:${encodeURIComponent(entity)}`,
          token,
        )
        return { entity, count: valueOf(m) }
      }),
    )

    const breakdownMetrics = [
      { key: "asset.count.by_market", tag: "market" },
      { key: "marketdata.count.by_market", tag: "market" },
      { key: "transaction.count.by_type", tag: "type" },
      { key: "news.count.by_source", tag: "source" },
    ]

    const breakdowns: Record<string, EntityCount[]> = {}
    for (const { key, tag } of breakdownMetrics) {
      const root = await fetchMetric(base, `beancounter.${key}`, "", token)
      const values = root?.availableTags?.find((t) => t.tag === tag)?.values
      if (!values) continue
      breakdowns[key] = await Promise.all(
        values.map(async (v) => {
          const m = await fetchMetric(
            base,
            `beancounter.${key}`,
            `?tag=${tag}:${encodeURIComponent(v)}`,
            token,
          )
          return { entity: v, count: valueOf(m) }
        }),
      )
    }

    res.status(200).json({
      service: "bc-data",
      counts: counts.sort((a, b) => b.count - a.count),
      breakdowns,
      fetchedAt: new Date().toISOString(),
    })
  } catch (error: unknown) {
    fetchError(req, res, error)
  }
}
