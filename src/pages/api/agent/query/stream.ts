import type { NextApiRequest, NextApiResponse } from "next"
import { Readable } from "node:stream"
import { auth0 } from "@lib/auth0"
import { getAgentUrl } from "@utils/api/bcConfig"

/**
 * SSE proxy to svc-agent's `/agent/query/stream` endpoint.
 *
 * The chat client (`useChat`) uses this when available so the browser sees a
 * first byte within ~1–2s instead of waiting for the full LLM + tool-call
 * chain to finish — which on heavy domains (Independence / Rebalance) can
 * exceed mobile-Safari's idle-timeout and surface as "Load failed".
 *
 * `createApiHandler` is bypassed because it materialises the upstream body
 * with `await response.text()` (see `responseWriter.ts`), which defeats the
 * point of streaming. This handler pipes the upstream `text/event-stream`
 * response through unchanged.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    res.status(405).end("Method Not Allowed")
    return
  }

  try {
    const session = await auth0.getSession(req)
    if (!session) {
      res.status(401).json({ error: "Not authenticated" })
      return
    }
    const { token: accessToken } = await auth0.getAccessToken(req, res)
    if (!accessToken) {
      res.status(401).json({ error: "Unauthorized" })
      return
    }

    const upstream = await fetch(getAgentUrl("/agent/query/stream"), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(req.body),
    })

    if (!upstream.ok || !upstream.body) {
      res.status(upstream.status).json({
        error: "Upstream stream failed",
        status: upstream.status,
      })
      return
    }

    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache, no-transform")
    res.setHeader("Connection", "keep-alive")
    // Disable buffering on any reverse proxy (nginx / Caddy with proxy_buffering)
    // so chunks reach the browser as fast as svc-agent emits them.
    res.setHeader("X-Accel-Buffering", "no")
    res.flushHeaders?.()

    const nodeStream = Readable.fromWeb(
      upstream.body as unknown as import("node:stream/web").ReadableStream,
    )
    nodeStream.on("error", (err) => {
      // Upstream error mid-stream — best we can do is end the response; the
      // already-sent SSE bytes may be partial but downstream parser handles
      // truncation gracefully.
      console.error("[/api/agent/query/stream] upstream error", err)
      res.end()
    })
    nodeStream.pipe(res)
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error"
    if (!res.headersSent) {
      res.status(500).json({ error: message })
    } else {
      res.end()
    }
  }
}

// Disable default body parser-based response timeout / size limits — we want
// to hold the connection open for as long as the LLM keeps producing.
export const config = {
  api: {
    responseLimit: false,
  },
}
