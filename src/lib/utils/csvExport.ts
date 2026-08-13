/**
 * Parse one CSV/TSV line into its fields, honouring quoted fields (commas
 * or tabs inside quotes don't split) and doubled-quote escaping (`""` -> `"`).
 * Fields are trimmed. Comma and tab are both treated as delimiters so the
 * same parser handles copy-pasted spreadsheet rows and exported CSV files.
 */
export function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++ // Skip escaped quote
      } else {
        inQuotes = !inQuotes
      }
    } else if ((char === "," || char === "\t") && !inQuotes) {
      result.push(current.trim())
      current = ""
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

/**
 * Escape a CSV field value (quote if contains comma, quote, or newline).
 */
export function escapeCSV(value: string): string {
  if (value == null) return ""
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Trigger a browser download of CSV content.
 */
export function downloadCsv(filename: string, csvContent: string): void {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Fetch CSV from an API endpoint and trigger download.
 */
export async function fetchAndDownloadCsv(
  apiUrl: string,
  filename: string,
): Promise<void> {
  const response = await fetch(apiUrl)
  if (!response.ok) {
    throw new Error(`Export failed: HTTP ${response.status}`)
  }
  const csvContent = await response.text()
  downloadCsv(filename, csvContent)
}
