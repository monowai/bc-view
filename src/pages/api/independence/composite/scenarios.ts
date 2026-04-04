import { createApiHandler } from "@utils/api/createApiHandler"
import { getCompositeScenariosUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: getCompositeScenariosUrl(),
  methods: ["POST"],
})
