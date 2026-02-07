import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const { id } = req.query
    if (req.method === "GET") {
      return getDataUrl(`/assets/${id}`)
    }
    return getDataUrl(`/assets/me/${id}`)
  },
  methods: ["GET", "DELETE", "PATCH"],
})
