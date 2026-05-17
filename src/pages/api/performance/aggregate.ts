import { createApiHandler } from "@utils/api/createApiHandler"
import { getPositionsUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: () => getPositionsUrl(`/performance/aggregate`),
  methods: ["POST"],
})
