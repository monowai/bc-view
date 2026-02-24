import useSwr from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"

export interface DefinedContributionResponse {
  employeeContribution: number
  employerContribution: number
  employeeRate: number
  cappedSalary: number
  hasDefinedContribution: boolean
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

  const { data, isLoading, error } = useSwr<DefinedContributionResponse>(
    url,
    url ? simpleFetcher(url) : null,
  )

  return { data, isLoading, error }
}
