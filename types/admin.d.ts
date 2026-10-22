// Admin Service Status payload shared by /api/admin/services and the page.

export interface DiskSpaceDetails {
  total: number
  free: number
  threshold: number
  path: string
}

export interface ComponentHealth {
  status: string
  details?: DiskSpaceDetails | Record<string, unknown>
}

export interface ServiceHealth {
  status: string
  components?: Record<string, ComponentHealth>
}

export interface ServiceInfo {
  git?: {
    branch?: string
    commit?: {
      id?: string
      time?: string
    }
  }
  build?: {
    version?: string
    artifact?: string
    name?: string
    time?: string
    ci?: {
      buildNumber?: string
    }
  }
}

export interface ServiceStatus {
  name: string
  /** Address the server probed. */
  url: string
  /** Browser-reachable URL when it differs from the probed one. */
  link?: string
  health: ServiceHealth | null
  info: ServiceInfo | null
  error: string | null
  responseTimeMs: number
}

export interface ServicesResponse {
  services: ServiceStatus[]
  timestamp: string
}

/** A Beancounter user as svc-data's `GET /admin/users` lists them. */
export interface AdminUser {
  /** SystemUser id. */
  id: string
  email: string
  active: boolean
  /** Date the account was created (yyyy-MM-dd). */
  since: string
  /** ISO instant of the last sign-in; null when never seen since tracking began. */
  lastSeen: string | null
}
