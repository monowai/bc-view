import { createApiHandler } from "@utils/api/createApiHandler"
import { getRetireUrl } from "@utils/api/bcConfig"

export default createApiHandler({
  url: getRetireUrl("/admin/quick-scenarios"),
  methods: ["GET", "POST"],
})
