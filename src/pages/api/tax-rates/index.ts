import { createApiHandler } from "@utils/api/createApiHandler"
import { getDataUrl } from "@utils/api/bcConfig"

/**
 * API route for user tax rates.
 * GET: Returns all tax rates for the current user.
 * POST: Creates or updates a tax rate for a country.
 */
export default createApiHandler({
  url: getDataUrl("/tax-rates"),
  methods: ["GET", "POST"],
})
