import { createApiHandler } from "@utils/api/createApiHandler"
import { getRetireUrl } from "@utils/api/bcConfig"

// Next.js query values can be string[] — fold each entry to a scalar string
// before handing the dict to URLSearchParams, otherwise array params get
// stringified as "v1,v2" which svc-retire won't parse as a BigDecimal.
function scalarQuery(
  query: Record<string, string | string[] | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(query)) {
    if (v == null) continue
    out[k] = Array.isArray(v) ? (v[0] ?? "") : v
  }
  return out
}

export default createApiHandler({
  url: (req) => {
    const qs = new URLSearchParams(scalarQuery(req.query)).toString()
    return getRetireUrl(`/cpf/balance-series?${qs}`)
  },
  methods: ["GET"],
})
