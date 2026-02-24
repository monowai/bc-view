import { createApiHandler } from "@utils/api/createApiHandler"
import { getRetireUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: (req) => {
    const { salary, age } = req.query
    return getRetireUrl(
      `/projection/defined-contribution?salary=${salary}&age=${age}`,
    )
  },
  methods: ["GET"],
})
