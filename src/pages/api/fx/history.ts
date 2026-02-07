import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const { from, to, months = "3" } = req.query
    return getDataUrl(`/fx/history?from=${from}&to=${to}&months=${months}`)
  },
})
