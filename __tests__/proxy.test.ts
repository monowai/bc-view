/**
 * @jest-environment node
 *
 * Node, not jsdom: the proxy only ever runs server-side, and jsdom does not
 * expose the WHATWG `Request`/`Response` globals it is handed.
 *
 * Next 16.3 deprecates the `middleware` file convention in favour of `proxy`.
 * The rename is not cosmetic for us: this file carries the Auth0 session and
 * route handling, a proxy file always runs on the Node.js runtime (never
 * edge), and Next hard-errors the build when both `src/middleware.ts` and
 * `src/proxy.ts` are present. These tests pin the parts that fail silently if
 * the migration regresses.
 */
import { existsSync } from "node:fs"
import path from "node:path"

const auth0Middleware = jest.fn()

jest.mock("@lib/auth0", () => ({
  auth0: {
    middleware: (request: Request): Promise<Response> =>
      auth0Middleware(request),
  },
}))

import * as proxyModule from "../src/proxy"

describe("proxy", () => {
  beforeEach(() => {
    auth0Middleware.mockReset()
  })

  it("delegates every request to the Auth0 handler", async () => {
    const response = new Response(null, { status: 204 })
    auth0Middleware.mockResolvedValue(response)
    const request = new Request("https://kauri.monowai.com/portfolios")

    await expect(proxyModule.proxy(request)).resolves.toBe(response)
    expect(auth0Middleware).toHaveBeenCalledWith(request)
  })

  it("keeps static assets, the favicon and the ping probe off the auth path", () => {
    expect(proxyModule.config.matcher).toHaveLength(1)
    const [matcher] = proxyModule.config.matcher
    for (const excluded of [
      "_next/static",
      "_next/image",
      "favicon.ico",
      "ping",
    ]) {
      expect(matcher).toContain(excluded)
    }
  })

  it("declares no route segment runtime — proxy is Node.js only", () => {
    expect(proxyModule).not.toHaveProperty("runtime")
  })

  it("has no leftover middleware file — Next fails the build if both exist", () => {
    expect(existsSync(path.join(process.cwd(), "src/middleware.ts"))).toBe(
      false,
    )
  })
})
