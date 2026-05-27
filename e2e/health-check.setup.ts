import { test as setup, expect } from "@playwright/test"

interface ServiceCheck {
  name: string
  url: string
  required: boolean
}

const services: ServiceCheck[] = [
  {
    name: "bc-data",
    url: process.env.BC_DATA_ACTUATOR || "http://localhost:9511",
    required: true,
  },
  {
    name: "bc-position",
    url: process.env.BC_POSITION_ACTUATOR || "http://localhost:9501",
    required: true,
  },
  {
    name: "bc-event",
    url: process.env.BC_EVENT_ACTUATOR || "http://localhost:9521",
    required: true,
  },
  {
    name: "bc-retire",
    url: process.env.BC_RETIRE_ACTUATOR || "http://localhost:9541",
    required: true,
  },
  {
    name: "bc-rebalance",
    url: process.env.BC_REBALANCE_ACTUATOR || "http://localhost:9551",
    required: process.env.E2E_SKIP_REBALANCE_CHECK !== "true",
  },
]

setup("backends are up", async ({ request }) => {
  const failures: string[] = []
  const warnings: string[] = []

  for (const svc of services) {
    const healthUrl = `${svc.url}/actuator/health`
    try {
      const res = await request.get(healthUrl, { timeout: 5000 })
      if (!res.ok()) {
        const msg = `${svc.name} ${healthUrl} -> ${res.status()}`
        if (svc.required) failures.push(msg)
        else warnings.push(msg)
        continue
      }
      const body = (await res.json()) as { status?: string }
      if (body.status !== "UP") {
        const msg = `${svc.name} ${healthUrl} status=${body.status}`
        if (svc.required) failures.push(msg)
        else warnings.push(msg)
      }
    } catch (err) {
      const msg = `${svc.name} ${healthUrl} unreachable: ${(err as Error).message}`
      if (svc.required) failures.push(msg)
      else warnings.push(msg)
    }
  }

  for (const w of warnings) {
    console.warn(`[health-check] WARN ${w}`)
  }

  expect(
    failures,
    `Required backend services not healthy:\n  - ${failures.join("\n  - ")}\nStart them via ./gradlew bootRun in the relevant repo, or set E2E_SKIP_REBALANCE_CHECK=true to skip svc-rebalance.`,
  ).toHaveLength(0)
})
