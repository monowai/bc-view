import useSwr from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"
import type { CategoryLabel, CategoryLabelsResponse } from "types/independence"

const categoriesKey = "/api/independence/categories"

/**
 * The category definitions, for their descriptions — "Medical, dental, vision,
 * insurance" says what a bucket actually covers in a way the name alone can't.
 * A plan's expenses only carry the category id and name, so the descriptions
 * have to be fetched alongside.
 */
export function useExpenseCategories(): {
  labels: CategoryLabel[] | undefined
  isLoading: boolean
} {
  const { data, isLoading } = useSwr<CategoryLabelsResponse>(
    categoriesKey,
    simpleFetcher(categoriesKey),
  )
  return { labels: data?.data, isLoading }
}
