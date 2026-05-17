import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"
import { transformTrnEnvelopeJson } from "@utils/trns/trnsSelectors"

const ALLOWED_SCOPES = new Set(["OWNED", "MANAGED", "ALL"])

function resolveScope(raw: unknown): string {
  const value = Array.isArray(raw) ? raw[0] : raw
  const normalised = typeof value === "string" ? value.toUpperCase() : ""
  return ALLOWED_SCOPES.has(normalised) ? normalised : "ALL"
}

export default createApiHandler({
  url: (req) => {
    const scope = resolveScope(req.query.scope)
    return getDataUrl(`/trns/proposed?scope=${scope}`)
  },
  transformJson: transformTrnEnvelopeJson,
})
