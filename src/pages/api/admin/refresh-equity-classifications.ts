import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: getDataUrl("/classifications/refresh/equity"),
  methods: ["POST"],
})
