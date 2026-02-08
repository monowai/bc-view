import { auth0 } from "@lib/auth0"
import { NextRequest } from "next/server"

export async function middleware(request: NextRequest): Promise<Response> {
  const response = await auth0.middleware(request)
  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|ping).*)"],
}
