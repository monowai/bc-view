import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    let { market, code } = req.query as { market?: string; code: string }
    if (code.includes(":")) {
      const parts = code.split(":")
      market = parts[0]
      code = parts[1]
    }
    if (!market) market = "US"
    return getDataUrl(`/assets/${market}/${code}`)
  },
})
