import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

/** Suggests when each imported holding was opened, from its cost. Records nothing. */
export default createApiHandler({
  url: getDataUrl("/brokers/reconcile/held-since"),
  methods: ["POST"],
})
