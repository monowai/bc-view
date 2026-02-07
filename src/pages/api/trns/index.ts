import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

export const baseUrl = getDataUrl("/trns")

export default createApiHandler({
  url: baseUrl,
  methods: ["POST"],
})
