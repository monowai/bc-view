import {
  createApiHandler,
  sanitizePathParam,
} from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    // Snyk Improper Type Validation (09c4ea12 / af2dcbf3 — CWE-1287):
    // Next.js types req.query values as `string | string[] | undefined`.
    // Calling .includes()/.split() on a string[] would crash the route.
    // sanitizePathParam normalises to string and rejects traversal chars.
    let code = sanitizePathParam(req.query.code, "code")
    let market = req.query.market
      ? sanitizePathParam(req.query.market, "market")
      : undefined
    if (code.includes(":")) {
      const parts = code.split(":")
      market = parts[0]
      code = parts[1]
    }
    if (!market) market = "US"
    return getDataUrl(`/assets/${market}/${code}`)
  },
})
