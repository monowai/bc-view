import { createApiHandler } from "@utils/api/createApiHandler"
import { getRetireUrl } from "@utils/api/bcConfig"

// Logically deleted scenarios that can still be restored (svc-retire #229).
// Static segment, so it takes precedence over [scenarioId]/index.ts.
export default createApiHandler({
  url: getRetireUrl("/scenarios/deleted"),
  methods: ["GET"],
})
