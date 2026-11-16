import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

/** Previews what recording the shown holdings would do. Read-only. */
export default createApiHandler({
  url: getDataUrl("/brokers/reconcile"),
  methods: ["POST"],
})
