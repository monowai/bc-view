import {
  createApiHandler,
  sanitizePathParam,
} from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    // Snyk Improper Type Validation (d9a2ccad — CWE-1287): req.query
    // values are `string | string[] | undefined`; .toUpperCase() on an
    // array would throw. sanitizePathParam normalises and validates.
    const countryCode = sanitizePathParam(
      req.query.countryCode,
      "countryCode",
    ).toUpperCase()
    return getDataUrl(`/tax-rates/${countryCode}`)
  },
  methods: ["GET", "DELETE"],
})
