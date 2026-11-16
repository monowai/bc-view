import { NextApiHandler } from "next"
import { Readable, Transform } from "node:stream"
import { auth0 } from "@lib/auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"

/**
 * Room for the multipart envelope around the file: the boundary lines and the
 * part's headers. The backend applies the exact limit to the file itself.
 */
const ENVELOPE_BYTES = 16 * 1024

interface UploadProxyConfig {
  /** Backend URL that takes the multipart body. */
  url: string
  /** The largest file the backend accepts, in bytes. */
  maxFileBytes: number
  /** What to tell the user when the upload is larger than that. */
  tooLargeMessage: string
}

/**
 * Proxies a multipart upload to the backend as a stream, byte for byte, so the
 * boundary the browser chose still matches the body. The route must switch the
 * body parser off (`export const config = { api: { bodyParser: false } }`):
 * a parsed body cannot be forwarded, and parsing would hold the whole upload
 * in memory.
 *
 * Nothing is buffered here. An upload over the limit is refused from its
 * declared length before a byte is read; one that declares no length, or lies,
 * is cut off as soon as the bytes that arrive pass the limit.
 */
export function createUploadProxyHandler(
  config: UploadProxyConfig,
): NextApiHandler {
  const maxBodyBytes = config.maxFileBytes + ENVELOPE_BYTES

  return async function handler(req, res) {
    let tooLarge = false
    const refuseTooLarge = (): void => {
      res.status(413).json({
        error: config.tooLargeMessage,
        message: config.tooLargeMessage,
      })
    }

    try {
      const session = await auth0.getSession(req)
      if (!session) {
        res.status(401).json({ error: "Not authenticated" })
        return
      }

      if (req.method?.toUpperCase() !== "POST") {
        res.setHeader("Allow", ["POST"])
        res.status(405).end(`Method ${req.method} Not Allowed`)
        return
      }

      const contentType = req.headers["content-type"] ?? ""
      if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
        const message = "Expected a multipart/form-data upload"
        res.status(415).json({ error: message, message })
        return
      }

      if (Number(req.headers["content-length"]) > maxBodyBytes) {
        refuseTooLarge()
        return
      }

      const { token: accessToken } = await auth0.getAccessToken(req, res)

      let seen = 0
      const limiter = new Transform({
        transform(chunk: Buffer, _encoding, callback) {
          seen += chunk.length
          if (seen > maxBodyBytes) {
            tooLarge = true
            callback(new Error(config.tooLargeMessage))
          } else {
            callback(null, chunk)
          }
        },
      })
      req.on("error", (error) => limiter.destroy(error))

      const response = await fetch(config.url, {
        method: "POST",
        headers: {
          ...requestInit(accessToken, "POST", req).headers,
          // Carries the boundary; the JSON default would not.
          "Content-Type": contentType,
        },
        body: Readable.toWeb(req.pipe(limiter)) as ReadableStream,
        // Node's fetch requires this for a streamed request body.
        duplex: "half",
      } as RequestInit)
      await handleResponse(response, res)
    } catch (error: unknown) {
      if (tooLarge) {
        refuseTooLarge()
      } else {
        fetchError(req, res, error)
      }
    }
  }
}
