import type { ParsedUrlQuery } from "querystring"
import type { PageContext } from "./pageContext"

/**
 * Single-phase Independence routes and the dynamic segment that carries the
 * phase id. A user-facing Plan is a journey of ordered phases; these pages
 * operate on one phase, so the agent is told which one via `phaseId` rather
 * than the generic `entityId`.
 *
 * The wizard's segment is spelled `[planId]` for historical reasons: it is a
 * phase (RetirementPlan) id, and the page loads the same
 * `/api/independence/plans/{id}/details` as `/independence/plans/[id]`. The
 * journey (IndependencePlan) id only ever arrives via the `plan` query param.
 */
const PHASE_ROUTE_PARAM: Record<string, string> = {
  "/independence/plans/[id]": "id",
  "/independence/wizard/[planId]": "planId",
}

function isIndependenceRoute(pathname: string): boolean {
  return pathname === "/independence" || pathname.startsWith("/independence/")
}

/**
 * Builds the context object sent to the agent with every chat question.
 *
 * `pathname` is the route pattern (`router.pathname`, e.g.
 * `/independence/plans/[id]`), `query` is `router.query`.
 */
export function buildChatContext(
  pathname: string,
  query: ParsedUrlQuery,
  pageContext: Pick<PageContext, "page" | "description">,
  livePageContext: string | null,
): Record<string, unknown> {
  const ctx: Record<string, unknown> = {
    page: pageContext.page,
    description: pageContext.description,
  }
  if (livePageContext) ctx.currentState = livePageContext
  // Managed (shared) portfolios are routed as /holdings/{portfolio.id}?byId=1
  // — in that case the dynamic [code] segment is actually the portfolio id,
  // so expose it as portfolioId for the agent's by-id tools rather than the
  // by-code ones (which 404 for shared portfolios).
  if (query.code) {
    if (query.byId === "1") {
      ctx.portfolioId = query.code
    } else {
      ctx.portfolioCode = query.code
    }
  }
  // The agent answers at whole-Plan level by default and narrows to a phase
  // only when phaseId is present.
  if (isIndependenceRoute(pathname) && typeof query.plan === "string") {
    if (query.plan) ctx.independencePlanId = query.plan
  }
  const phaseParam = PHASE_ROUTE_PARAM[pathname]
  if (phaseParam) {
    if (query[phaseParam]) ctx.phaseId = query[phaseParam]
  } else if (query.id) {
    ctx.entityId = query.id
  }
  if (query.modelId) ctx.modelId = query.modelId
  return ctx
}
