import { withMiddlewareAuthRequired } from "@auth0/nextjs-auth0/edge"

export default withMiddlewareAuthRequired()

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (Auth0 authentication routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - ping (health check)
     * - / (home page - allow unauthenticated access)
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|ping|$).*)",
  ],
}