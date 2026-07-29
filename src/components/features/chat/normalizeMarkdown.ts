/**
 * Repairs the two markdown defects the agent's LLM reliably emits, both of
 * which render as raw source in the chat panel:
 *
 * 1. `##Heading` — CommonMark requires a space after the `#` run, so without
 *    it react-markdown prints the literal hashes.
 * 2. A GFM table glued straight onto the preceding paragraph line. remark-gfm
 *    only starts a table at a block boundary, so the pipes render as text.
 *
 * Fixing this client-side rather than only in the system prompt means a
 * sloppy generation degrades to correct output instead of raw markdown.
 * Content inside fenced code blocks is passed through untouched.
 */

/** `#` … `######` immediately followed by a non-space, non-hash character. */
const UNSPACED_HEADING = /^(\s{0,3})(#{1,6})(?=[^\s#])/

/** A GFM table row: starts and ends with a pipe once trimmed. */
const TABLE_ROW = /^\s*\|.*\|\s*$/

const FENCE = /^\s*(```|~~~)/

export function normalizeMarkdown(content: string): string {
  if (!content) return content

  const out: string[] = []
  let inFence = false

  for (const line of content.split("\n")) {
    if (FENCE.test(line)) {
      inFence = !inFence
      out.push(line)
      continue
    }
    if (inFence) {
      out.push(line)
      continue
    }

    const spaced = line.replace(UNSPACED_HEADING, "$1$2 ")

    // A table's first row needs a blank line above it. Only the *first* row
    // qualifies — a previous line that is itself a table row means we're
    // already inside the table.
    const prev = out[out.length - 1]
    const needsBlankLine =
      TABLE_ROW.test(spaced) &&
      prev !== undefined &&
      prev.trim() !== "" &&
      !TABLE_ROW.test(prev)
    if (needsBlankLine) out.push("")

    out.push(spaced)
  }

  return out.join("\n")
}
