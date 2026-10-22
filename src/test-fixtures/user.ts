import { ApiKey } from "types/beancounter"
import { AdminUser } from "types/admin"

export function makeApiKey(overrides: Partial<ApiKey> = {}): ApiKey {
  return {
    id: "key-1",
    name: "My Agent",
    prefix: "bc_a1b2c3d4",
    scopes: ["beancounter:read"],
    createdAt: "2026-01-01T00:00:00Z",
    expiresAt: null,
    lastUsedAt: null,
    revokedAt: null,
    ...overrides,
  }
}

export function makeAdminUser(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: "user-1",
    email: "user@example.com",
    active: true,
    since: "2026-01-02",
    lastSeen: "2026-10-20T03:04:05Z",
    ...overrides,
  }
}
