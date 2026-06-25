import useSwr from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"

/**
 * A single defined-contribution bucket (e.g. CPF OA / SA|RA / MA). `amount` is
 * the TOTAL employee + employer contribution allocated to that bucket.
 */
export interface DefinedContributionBucket {
  code: string
  amount: number
}

export interface DefinedContributionResponse {
  employeeContribution: number
  employerContribution: number
  employeeRate: number
  cappedSalary: number
  hasDefinedContribution: boolean
  // Per-bucket split of the total contribution. Empty when there is no
  // defined-contribution scheme (e.g. no CPF). Codes: "OA", "SA"|"RA", "MA".
  buckets?: DefinedContributionBucket[]
}

/**
 * Fetches the auto-calculated defined contribution (e.g., CPF) for a given salary and age.
 * Only fetches when salary > 0 and age is defined.
 */
export function useDefinedContribution(
  salary: number,
  age: number | undefined,
): {
  data: DefinedContributionResponse | undefined
  isLoading: boolean
  error: Error | undefined
} {
  const shouldFetch = salary > 0 && age != null && age > 0

  const url = shouldFetch
    ? `/api/independence/projection/defined-contribution?salary=${salary}&age=${age}`
    : null

  // keepPreviousData: the salary is in the URL, so every keystroke is a new SWR
  // key. Without this, `data` blips to undefined between keys and any
  // consumer gating UI on it (e.g. the payslip pension box) unmounts/remounts
  // on every character — a visible flash. Hold the last result while the next
  // loads; values just update in place.
  const { data, isLoading, error } = useSwr<DefinedContributionResponse>(
    url,
    url ? simpleFetcher(url) : null,
    { keepPreviousData: true },
  )

  return { data, isLoading, error }
}
