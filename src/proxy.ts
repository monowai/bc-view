import { auth0 } from "@lib/auth0"

export function proxy(request: Request): Promise<Response> {
  return auth0.middleware(request)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|ping).*)"],
}
