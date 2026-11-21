import { mutate } from "swr"
import { isNetWorthKey } from "@utils/api/client/holdings"

/**
 * Refetch every cached net-worth headline. Call it wherever a saved trn
 * refreshes today's holdings: net worth is cached for a minute and does not
 * revalidate on focus, so without this the Net Worth figures stay stale.
 */
export const refreshNetWorth = (): Promise<unknown[]> => mutate(isNetWorthKey)
