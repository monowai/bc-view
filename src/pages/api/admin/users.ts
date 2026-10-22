import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

/** Every Beancounter user, most recently seen first (admin only, svc-data). */
export default createApiHandler({ url: getDataUrl("/admin/users") })
