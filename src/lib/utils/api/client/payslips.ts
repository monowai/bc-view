/**
 * Browser-side calls for the signed-in user's recurring payslip
 * (`/api/payslips/recurring`, svc-data). One per user: svc-data posts it
 * monthly on `dayOfMonth`, with svc-retire calculating the legs.
 *
 * The key doubles as the SWR cache key: keep it byte-identical.
 */
import { jsonInit } from "@utils/api/client/request"

export const recurringPayslipKey = "/api/payslips/recurring"

export interface RecurringPayslip {
  id: string
  portfolioId: string
  cashAssetId: string
  grossSalary: number
  tax: number
  dayOfMonth: number
  nextPayDate: string
}

export interface RecurringPayslipResponse {
  data: RecurringPayslip | null
}

/** The first payslip is posted by the caller; this schedules the next ones. */
export interface RecurringPayslipRequest {
  portfolioId: string
  cashAssetId: string
  grossSalary: number
  tax: number
  payDate: string
}

export function saveRecurringPayslip(
  request: RecurringPayslipRequest,
): Promise<Response> {
  return fetch(recurringPayslipKey, jsonInit("PUT", request))
}

export function stopRecurringPayslip(): Promise<Response> {
  return fetch(recurringPayslipKey, { method: "DELETE" })
}
