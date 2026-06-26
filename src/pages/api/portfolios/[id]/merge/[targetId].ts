import {
  createApiHandler,
  sanitizePathParam,
} from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

// Proxies the portfolio-merge (consolidate) op to svc-data:
// POST /portfolios/{id}/merge/{targetId} — reassigns every transaction from the
// source ({id}) into the target, then deletes the emptied source. The slug must
// be `[id]` (not `[sourceId]`) to match the sibling `[id].ts` route — Next.js
// requires one slug name per dynamic path position.
//
// Both ids are sanitised before interpolation: this route triggers an
// irreversible merge+delete, so a path-traversal value must never reach the
// backend URL.
export default createApiHandler({
  url: (req) => {
    const id = sanitizePathParam(req.query.id, "portfolio id")
    const targetId = sanitizePathParam(req.query.targetId, "target id")
    return getDataUrl(`/portfolios/${id}/merge/${targetId}`)
  },
  methods: ["POST"],
})
