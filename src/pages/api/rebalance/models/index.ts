import { createApiHandler } from "@utils/api/createApiHandler"
import { getRebalanceUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: getRebalanceUrl("/models"),
  methods: ["GET", "POST"],
})
