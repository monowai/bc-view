import { auth0 } from "@lib/auth0"

// Next 16.3 renamed the `middleware` file convention to `proxy`. The file must
// sit at `src/proxy.ts` (alongside the app source), never the repo root, and
// export a function named `proxy`. Unlike middleware, a proxy always runs on
// the Node.js runtime — route segment config (`export const runtime`) is
// rejected outright.
export function proxy(request: Request): Promise<Response> {
  return auth0.middleware(request)
}

// The exclusions are regex, not literals, so the dot in `favicon.ico` has to
// be escaped — unescaped it matches any character and drops /faviconXico off
// the auth path as well.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|ping).*)"],
}
