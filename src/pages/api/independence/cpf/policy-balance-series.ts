import { createApiHandler } from "@utils/api/createApiHandler"
import { getRetireUrl } from "@utils/api/bcConfig"

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
    return getRetireUrl(`/cpf/policy-balance-series?${qs}`)
  },
  methods: ["GET"],
})
