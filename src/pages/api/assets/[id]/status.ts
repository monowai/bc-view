import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const { id } = req.query
    return getDataUrl(`/assets/${id}/status`)
  },
  methods: ["PATCH"],
})
