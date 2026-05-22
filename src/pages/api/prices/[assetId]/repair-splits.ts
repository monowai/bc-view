import {
  createApiHandler,
  sanitizePathParam,
} from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

/**
 * Forwards the user's bearer token to bc-data's
 * `POST /prices/{assetId}/repair-splits`. The server-side gate on bc-data
 * requires admin scope; non-admin tokens get 403 from the bc-data side.
 */
export default createApiHandler({
  url: (req) => {
    const assetId = sanitizePathParam(req.query.assetId, "assetId")
    return getDataUrl(`/prices/${assetId}/repair-splits`)
  },
  methods: ["POST"],
})
