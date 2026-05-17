import { createApiHandler } from "@utils/api/createApiHandler"
import { getCompositeMonteCarloUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: getCompositeMonteCarloUrl(),
  methods: ["POST"],
})
