import { NextResponse } from "next/server"

export function middleware(): NextResponse {
  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|ping|$).*)"],
}
