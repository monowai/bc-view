import { createApiHandler } from "@utils/api/createApiHandler"
import { getCompositeProjectionUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: getCompositeProjectionUrl(),
  methods: ["POST"],
})
