/**
 * A `Response`-shaped object whose body streams the given SSE events, in the
 * exact wire format Spring's `ServerSentEvent` writer uses (`data:<value>`,
 * no space after the colon). `delayMs` spaces the events out so a test can
 * observe the in-flight state.
 */
export function sseResponse(
  events: Array<{ event: string; data: string }>,
  opts: { delayMs?: number } = {},
): { ok: true; status: number; body: ReadableStream<Uint8Array> } {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const e of events) {
        if (opts.delayMs) {
          await new Promise((r) => setTimeout(r, opts.delayMs))
        }
        controller.enqueue(
          encoder.encode(`event:${e.event}\ndata:${e.data}\n\n`),
        )
      }
      controller.close()
    },
  })
  return { ok: true, status: 200, body }
}

/** Token events for `text`, then `done`. */
export function sseAnswer(text: string): ReturnType<typeof sseResponse> {
  return sseResponse([
    { event: "token", data: text },
    { event: "done", data: "{}" },
  ])
}

/**
 * `fetch` for a Quick Analysis popup test. Every popup first asks to save its
 * run to chat history; this declines (503), so the popup runs statelessly and
 * `streamFetch` sees only the stream requests, in order. Saving itself is
 * covered by AnalysisDialog's tests.
 */
export function withUnsavedAnalyses(
  streamFetch: (url: string, init?: RequestInit) => unknown,
): typeof fetch {
  return ((url: string, init?: RequestInit) =>
    url === "/api/agent/conversations" && init?.method === "POST"
      ? Promise.resolve({
          ok: false,
          status: 503,
          json: () => Promise.resolve({}),
        })
      : streamFetch(url, init)) as unknown as typeof fetch
}
