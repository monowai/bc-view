import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

/** Records the rows the user confirmed. All or nothing. */
export default createApiHandler({
  url: getDataUrl("/brokers/reconcile/commit"),
  methods: ["POST"],
})
