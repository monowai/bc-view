import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const price = req.query.price as string[]
    return getDataUrl(`/prices/${price.join("/")}`)
  },
})
