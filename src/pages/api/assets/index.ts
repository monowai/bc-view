import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    if (req.method === "GET") {
      const category = req.query.category as string
      return category
        ? getDataUrl(`/assets/me/${category}`)
        : getDataUrl("/assets/me")
    }
    return getDataUrl("/assets")
  },
  methods: ["GET", "POST"],
})
