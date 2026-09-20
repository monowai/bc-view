/**
 * Reads the reason a request was refused out of the response.
 *
 * The BFF forwards a backend rejection as `{ error, message, code }` (see
 * responseWriter), so `message` is preferred, then `error`, then whatever raw
 * body came back. Only when the body says nothing at all does the caller's
 * `fallback` stand in, with the status appended so a silent refusal is still
 * identifiable.
 *
 * Every write the setup wizard makes goes through this: a backend that names
 * its reason ("Set a target independence age...", "plan is shared with 2
 * people") tells the user what to do next, and "Failed to save" does not.
 *
 * @param res      the non-ok response
 * @param fallback what to say when the body carries no reason
 */
export async function readErrorMessage(
  res: Response,
  fallback: string,
): Promise<string> {
  const detail = await errorDetail(res)
  if (detail) return detail
  const status = [res.status, res.statusText].filter(Boolean).join(" ")
  return status ? `${fallback}: ${status}` : fallback
}

async function errorDetail(res: Response): Promise<string> {
  // Guards a hand-rolled Response stub as much as a real one — a body that
  // cannot be read is the same as a body that says nothing.
  if (typeof res.text !== "function") return ""
  const body = (await res.text().catch(() => "")).trim()
  if (!body) return ""
  try {
    const parsed: unknown = JSON.parse(body)
    if (parsed && typeof parsed === "object") {
      const { message, error } = parsed as { message?: string; error?: string }
      const detail = message?.trim() || error?.trim()
      if (detail) return detail
    }
  } catch {
    // Not JSON — the raw body is the best answer available.
  }
  return body
}
