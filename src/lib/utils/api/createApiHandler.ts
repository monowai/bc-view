import { NextApiHandler, NextApiRequest, NextApiResponse } from "next"
import { auth0 } from "@lib/auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"

type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE"

const DEFAULT_BODY_METHODS: HttpMethod[] = ["POST", "PATCH", "PUT"]

interface ApiHandlerConfig {
  /** Backend URL - static string or function of request */
  url: string | ((req: NextApiRequest) => string)
  /** Allowed HTTP methods (default: ["GET"]) */
  methods?: HttpMethod[]
  /** Methods that should forward req.body as JSON (default: ["POST", "PATCH", "PUT"]) */
  bodyMethods?: HttpMethod[]
}

export function createApiHandler(config: ApiHandlerConfig): NextApiHandler {
  const { methods = ["GET"], bodyMethods = DEFAULT_BODY_METHODS } = config

  return async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
      const session = await auth0.getSession(req)
      if (!session) {
        res.status(401).json({ error: "Not authenticated" })
        return
      }

      const method = req.method?.toUpperCase() as HttpMethod
      if (!methods.includes(method)) {
        res.setHeader("Allow", methods)
        res.status(405).end(`Method ${req.method} Not Allowed`)
        return
      }

      const { token: accessToken } = await auth0.getAccessToken(req, res)
      const url =
        typeof config.url === "function" ? config.url(req) : config.url

      const init = bodyMethods.includes(method)
        ? {
            ...requestInit(accessToken, method, req),
            body: JSON.stringify(req.body),
          }
        : requestInit(accessToken, method, req)

      const response = await fetch(url, init)
      await handleResponse(response, res)
    } catch (error: unknown) {
      fetchError(req, res, error)
    }
  }
}
