# Auth0 v4 Migration

## Overview

Migrated from `@auth0/nextjs-auth0` v3.8.0 to v4.14.1 for Next.js 16 compatibility.

## Key Changes

### Auth Routes

Auth routes moved from `/api/auth/*` to `/auth/*`, auto-registered by the Auth0 middleware:

- `/auth/login` - Login redirect
- `/auth/logout` - Logout
- `/auth/callback` - OAuth callback
- `/auth/profile` - Session/user info (JSON endpoint)

### Environment Variables

| v3                                        | v4                                     |
| ----------------------------------------- | -------------------------------------- |
| `AUTH0_BASE_URL`                          | `APP_BASE_URL`                         |
| `AUTH0_ISSUER_BASE_URL` (with `https://`) | `AUTH0_DOMAIN` (domain only)           |
| `AUTH0_AUDIENCE` env var                  | Configured in `src/lib/utils/auth0.ts` |
| `AUTH0_SECRET`                            | Unchanged                              |
| `AUTH0_CLIENT_ID`                         | Unchanged                              |
| `AUTH0_CLIENT_SECRET`                     | Unchanged                              |

### API Route Protection

`withApiAuthRequired` was removed. API routes now use:

```typescript
import { auth0 } from "@lib/auth0"

const session = await auth0.getSession(req)
if (!session) {
  return res.status(401).json({ error: "Not authenticated" })
}
const { token: accessToken } = await auth0.getAccessToken(req, res)
```

### Client-Side

| v3                     | v4              |
| ---------------------- | --------------- |
| `UserProvider`         | `Auth0Provider` |
| `UserProfile` type     | `User` type     |
| `withPageAuthRequired` | Unchanged       |
| `useUser` hook         | Unchanged       |

### Middleware

`src/middleware.ts` runs the Auth0 middleware on all routes (must be in `src/` with Pages Router):

```typescript
import { auth0 } from "./lib/utils/auth0"
export async function middleware(request: NextRequest): Promise<Response> {
  return await auth0.middleware(request)
}
```

### Auth0 Dashboard Settings

Ensure callback URLs include the v4 paths:

- **Allowed Callback URLs**: `http://localhost:3000/auth/callback`
- **Allowed Logout URLs**: `http://localhost:3000/`
- **Allowed Web Origins**: `http://localhost:3000`

## Security Headers

Configured in `next.config.js`:

- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
