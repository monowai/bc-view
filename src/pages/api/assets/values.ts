import { createApiHandler } from "@utils/api/createApiHandler"
import { getRetireUrl } from "@utils/api/bcConfig"

/**
 * Proxies `GET /assets/values` to svc-retire. Returns the authenticated
 * user's per-asset market values keyed by `assetId`, used by the
 * AssetDisposal wizard to autofill `currentValue` when an asset is
 * selected from the holdings picker.
 *
 * Optional `?currency=NZD` query parameter forwards to svc-retire for
 * pre-conversion.
 */
export default createApiHandler({
  url: getRetireUrl("/assets/values"),
  methods: ["GET"],
})
