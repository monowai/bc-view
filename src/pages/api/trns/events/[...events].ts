import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const events = req.query.events as string[]
    return getDataUrl(`/trns/${events[0]}/asset/${events[1]}/events`)
  },
})
