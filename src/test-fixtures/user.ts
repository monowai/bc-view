import { ApiKey } from "types/beancounter"

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
