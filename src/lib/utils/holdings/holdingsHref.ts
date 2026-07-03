/**
 * Build the holdings-page URL that scrolls to and highlights a specific asset row.
 *
 * The holdings page (`src/pages/holdings/[code].tsx`) reads the `#asset-<id>`
 * hash fragment on mount, scrolls the matching row into view, and flashes the
 * `asset-target` highlight. Both the portfolio code (path segment) and the
 * asset id (hash) are URL-encoded so codes/ids containing reserved characters
 * navigate correctly.
 */
export function holdingsHighlightHref(
  portfolioCode: string,
  assetId: string,
): string {
  return `/holdings/${encodeURIComponent(portfolioCode)}#asset-${encodeURIComponent(assetId)}`
}
