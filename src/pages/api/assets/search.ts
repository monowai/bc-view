import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const { keyword, market } = req.query
    const params = new URLSearchParams({ keyword: keyword as string })
    if (market && typeof market === "string") {
      params.append("market", market)
    }
    return getDataUrl(`/assets/search?${params.toString()}`)
  },
})
