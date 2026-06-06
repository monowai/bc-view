import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"
import { transformTrnEnvelopeJson } from "@utils/trns/trnsSelectors"

const ALLOWED_SCOPES = new Set(["OWNED", "MANAGED", "ALL"])
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

function resolveScope(raw: unknown): string {
  const value = Array.isArray(raw) ? raw[0] : raw
  const normalised = typeof value === "string" ? value.toUpperCase() : ""
  return ALLOWED_SCOPES.has(normalised) ? normalised : "ALL"
}

// Only forward a well-formed ISO date; svc-data defaults asAt to today when absent.
function resolveAsAt(raw: unknown): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw
  return typeof value === "string" && ISO_DATE.test(value) ? value : null
}

export default createApiHandler({
  url: (req) => {
    const scope = resolveScope(req.query.scope)
    const asAt = resolveAsAt(req.query.asAt)
    const query = asAt ? `scope=${scope}&asAt=${asAt}` : `scope=${scope}`
    return getDataUrl(`/trns/proposed?${query}`)
  },
  transformJson: transformTrnEnvelopeJson,
})
