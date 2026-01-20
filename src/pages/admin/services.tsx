import React from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useTranslation } from "next-i18next"
import { GetServerSideProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { rootLoader } from "@components/ui/PageLoader"
import { useIsAdmin } from "@hooks/useIsAdmin"
import Link from "next/link"
import useSWR from "swr"
import { simpleFetcher } from "@utils/api/fetchHelper"

interface DiskSpaceDetails {
  total: number
  free: number
  threshold: number
  path: string
}

interface ComponentHealth {
  status: string
  details?: DiskSpaceDetails | Record<string, unknown>
}

interface ServiceHealth {
  status: string
  components?: Record<string, ComponentHealth>
}

interface ServiceInfo {
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

interface ServiceStatus {
  name: string
  url: string
  health: ServiceHealth | null
  info: ServiceInfo | null
  error: string | null
  responseTimeMs: number
}

interface ServicesResponse {
  services: ServiceStatus[]
  timestamp: string
}

function getStatusColor(status: string): string {
  switch (status?.toUpperCase()) {
    case "UP":
      return "bg-green-100 text-green-800"
    case "DOWN":
      return "bg-red-100 text-red-800"
    case "UNREACHABLE":
      return "bg-gray-100 text-gray-800"
    default:
      return "bg-yellow-100 text-yellow-800"
  }
}

function getStatusIcon(status: string): string {
  switch (status?.toUpperCase()) {
    case "UP":
      return "fa-check-circle text-green-500"
    case "DOWN":
      return "fa-times-circle text-red-500"
    case "UNREACHABLE":
      return "fa-question-circle text-gray-500"
    default:
      return "fa-exclamation-circle text-yellow-500"
  }
}

function formatCommitId(commitId?: string): string {
  if (!commitId) return "-"
  return commitId.substring(0, 7)
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "-"
  try {
    return new Date(dateStr).toLocaleString()
  } catch {
    return dateStr
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

function isDiskSpaceDetails(details: unknown): details is DiskSpaceDetails {
  return (
    typeof details === "object" &&
    details !== null &&
    "free" in details &&
    "total" in details
  )
}

function ServiceCard({ service }: { service: ServiceStatus }): React.ReactElement {
  const { t } = useTranslation("common")
  const status = service.health?.status || "UNKNOWN"
  const gitInfo = service.info?.git
  const buildInfo = service.info?.build

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <i className={`fas ${getStatusIcon(status)} text-xl`}></i>
          <h3 className="font-semibold text-gray-900">{service.name}</h3>
        </div>
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(status)}`}
        >
          {status}
        </span>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Version info */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-500">{t("admin.services.version", "Version")}:</span>
            <span className="ml-2 font-mono text-gray-900">
              {buildInfo?.version || "-"}
            </span>
          </div>
          <div>
            <span className="text-gray-500">{t("admin.services.branch", "Branch")}:</span>
            <span className="ml-2 font-mono text-gray-900">
              {gitInfo?.branch || "-"}
            </span>
          </div>
        </div>

        {/* Git info */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-gray-500">{t("admin.services.commit", "Commit")}:</span>
            <span
              className="ml-2 font-mono text-gray-900 cursor-help"
              title={buildInfo?.ci?.buildNumber ? `Build #${buildInfo.ci.buildNumber}` : undefined}
            >
              {formatCommitId(gitInfo?.commit?.id)}
            </span>
          </div>
          <div>
            <span className="text-gray-500">{t("admin.services.built", "Built")}:</span>
            <span className="ml-2 text-gray-900">
              {formatDate(gitInfo?.commit?.time || buildInfo?.time)}
            </span>
          </div>
        </div>

        {/* Response time */}
        <div className="text-sm">
          <span className="text-gray-500">{t("admin.services.responseTime", "Response")}:</span>
          <span className="ml-2 text-gray-900">{service.responseTimeMs}ms</span>
        </div>

        {/* URL */}
        <div className="text-sm">
          <span className="text-gray-500">{t("admin.services.url", "URL")}:</span>
          <span className="ml-2 font-mono text-xs text-gray-600 break-all">
            {service.url}
          </span>
        </div>

        {/* Error message if any */}
        {service.error && (
          <div className="mt-2 p-2 bg-red-50 rounded text-sm text-red-700">
            <i className="fas fa-exclamation-triangle mr-2"></i>
            {service.error}
          </div>
        )}

        {/* Component health details */}
        {service.health?.components && Object.keys(service.health.components).length > 0 && (
          <details className="mt-2">
            <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
              {t("admin.services.components", "Components")} ({Object.keys(service.health.components).length})
            </summary>
            <div className="mt-2 pl-4 space-y-1">
              {Object.entries(service.health.components).map(([name, comp]) => (
                <div key={name} className="text-sm">
                  <div className="flex items-center">
                    <i className={`fas ${getStatusIcon(comp.status)} text-xs mr-2`}></i>
                    <span className="text-gray-600">{name}:</span>
                    <span className={`ml-2 ${comp.status === "UP" ? "text-green-600" : "text-red-600"}`}>
                      {comp.status}
                    </span>
                    {name === "diskSpace" && isDiskSpaceDetails(comp.details) && (
                      <span className="ml-2 text-gray-500">
                        ({formatBytes(comp.details.free)} free / {formatBytes(comp.details.total)})
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
    </div>
  )
}

export default withPageAuthRequired(function ServicesPage(): React.ReactElement {
  const { t, ready } = useTranslation("common")
  const { isAdmin, isLoading } = useIsAdmin()

  const { data, error, isLoading: loadingServices, mutate } = useSWR<ServicesResponse>(
    isAdmin ? "/api/admin/services" : null,
    simpleFetcher("/api/admin/services"),
    { refreshInterval: 30000 } // Refresh every 30 seconds
  )

  if (!ready || isLoading) {
    return rootLoader(t("loading"))
  }

  if (!isAdmin) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <i className="fas fa-lock text-4xl text-red-400 mb-4"></i>
          <h1 className="text-xl font-semibold text-red-700 mb-2">
            {t("admin.accessDenied.title", "Access Denied")}
          </h1>
          <p className="text-red-600">
            {t(
              "admin.accessDenied.message",
              "You do not have permission to access the admin area.",
            )}
          </p>
          <Link
            href="/portfolios"
            className="inline-block mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
          >
            {t("admin.accessDenied.goBack", "Return to Portfolios")}
          </Link>
        </div>
      </div>
    )
  }

  const allUp = data?.services?.every((s) => s.health?.status === "UP") ?? false

  return (
    <div className="max-w-6xl mx-auto py-6 px-4">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center space-x-2 mb-1">
            <Link
              href="/admin"
              className="text-gray-500 hover:text-gray-700 transition-colors"
            >
              <i className="fas fa-arrow-left"></i>
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">
              {t("admin.services.title", "Service Status")}
            </h1>
          </div>
          <p className="text-gray-600">
            {t("admin.services.description", "Monitor health and version of backend services")}
          </p>
        </div>
        <div className="flex items-center space-x-4">
          {/* Overall status indicator */}
          {data && (
            <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${allUp ? "bg-green-100" : "bg-yellow-100"}`}>
              <i className={`fas ${allUp ? "fa-check-circle text-green-500" : "fa-exclamation-circle text-yellow-500"}`}></i>
              <span className={allUp ? "text-green-700" : "text-yellow-700"}>
                {allUp
                  ? t("admin.services.allUp", "All services operational")
                  : t("admin.services.someDown", "Some services degraded")}
              </span>
            </div>
          )}
          <button
            onClick={() => mutate()}
            disabled={loadingServices}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400 transition-colors flex items-center space-x-2"
          >
            <i className={`fas fa-sync-alt ${loadingServices ? "fa-spin" : ""}`}></i>
            <span>{t("admin.services.refresh", "Refresh")}</span>
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <i className="fas fa-exclamation-triangle text-red-500 mr-2"></i>
          <span className="text-red-700">
            {t("admin.services.fetchError", "Failed to fetch service status")}
          </span>
        </div>
      )}

      {/* Loading state */}
      {loadingServices && !data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-4 animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      )}

      {/* Services grid */}
      {data?.services && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.services.map((service) => (
              <ServiceCard key={service.name} service={service} />
            ))}
          </div>

          {/* Last updated */}
          <div className="mt-4 text-sm text-gray-500 text-right">
            {t("admin.services.lastUpdated", "Last updated")}: {formatDate(data.timestamp)}
          </div>
        </>
      )}
    </div>
  )
})

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
