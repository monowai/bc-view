import { createApiHandler } from "@utils/api/createApiHandler"
import { getRetireUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: getRetireUrl("/plans"),
  methods: ["GET", "POST"],
})
