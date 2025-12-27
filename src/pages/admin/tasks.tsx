import React, { useState } from "react"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useTranslation } from "next-i18next"
import { GetServerSideProps } from "next"
import { serverSideTranslations } from "next-i18next/serverSideTranslations"
import { rootLoader } from "@components/ui/PageLoader"
import { useIsAdmin } from "@hooks/useIsAdmin"
import Link from "next/link"

interface TaskResult {
  success: boolean
  message: string
  data?: unknown
}

interface ScheduledTask {
  id: string
  name: string
  description: string
  endpoint: string
  icon: string
  service: string
}

const SCHEDULED_TASKS: ScheduledTask[] = [
  {
    id: "refresh-prices",
    name: "Refresh Asset Prices",
    description: "Update market prices for all tracked assets",
    endpoint: "/api/admin/refresh-prices",
    icon: "fa-chart-line",
    service: "svc-data",
  },
  {
    id: "refresh-etf-sectors",
    name: "Refresh ETF Sectors",
    description: "Update sector weightings and top holdings for all ETFs",
    endpoint: "/api/admin/refresh-etf-sectors",
    icon: "fa-pie-chart",
    service: "svc-data",
  },
  {
    id: "refresh-equity-classifications",
    name: "Refresh Equity Classifications",
    description: "Update sector/industry classifications for all equities",
    endpoint: "/api/admin/refresh-equity-classifications",
    icon: "fa-tags",
    service: "svc-data",
  },
  {
    id: "load-events",
    name: "Load Corporate Events",
    description: "Fetch new dividends and splits from external sources",
    endpoint: "/api/admin/load-events",
    icon: "fa-download",
    service: "svc-event",
  },
  {
    id: "process-events",
    name: "Process Corporate Events",
    description: "Generate transactions for pending corporate events",
    endpoint: "/api/admin/process-events",
    icon: "fa-cogs",
    service: "svc-event",
  },
]

export default withPageAuthRequired(function ScheduledTasksPage(): React.ReactElement {
  const { t, ready } = useTranslation("common")
  const { isAdmin, isLoading } = useIsAdmin()
  const [runningTasks, setRunningTasks] = useState<Set<string>>(new Set())
  const [taskResults, setTaskResults] = useState<Record<string, TaskResult>>({})

  const runTask = async (task: ScheduledTask): Promise<void> => {
    setRunningTasks((prev) => new Set(prev).add(task.id))
    setTaskResults((prev) => {
      const newResults = { ...prev }
      delete newResults[task.id]
      return newResults
    })

    try {
      const response = await fetch(task.endpoint, { method: "POST" })
      const data = await response.json().catch(() => null)

      if (response.ok) {
        setTaskResults((prev) => ({
          ...prev,
          [task.id]: {
            success: true,
            message: t("admin.tasks.success", "Task completed successfully"),
            data,
          },
        }))
      } else {
        setTaskResults((prev) => ({
          ...prev,
          [task.id]: {
            success: false,
            message: data?.message || t("admin.tasks.failed", "Task failed"),
            data,
          },
        }))
      }
    } catch (error) {
      setTaskResults((prev) => ({
        ...prev,
        [task.id]: {
          success: false,
          message:
            error instanceof Error
              ? error.message
              : t("admin.tasks.error", "An error occurred"),
        },
      }))
    } finally {
      setRunningTasks((prev) => {
        const newSet = new Set(prev)
        newSet.delete(task.id)
        return newSet
      })
    }
  }

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

  // Group tasks by service
  const tasksByService = SCHEDULED_TASKS.reduce(
    (acc, task) => {
      if (!acc[task.service]) {
        acc[task.service] = []
      }
      acc[task.service].push(task)
      return acc
    },
    {} as Record<string, ScheduledTask[]>,
  )

  return (
    <div className="max-w-4xl mx-auto py-6 px-4">
      <div className="mb-6">
        <Link
          href="/admin"
          className="text-blue-600 hover:text-blue-800 text-sm"
        >
          <i className="fas fa-arrow-left mr-2"></i>
          {t("admin.backToAdmin", "Back to Admin")}
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          {t("admin.tasks.title", "Scheduled Tasks")}
        </h1>
        <p className="text-gray-600 mt-1">
          {t(
            "admin.tasks.description",
            "Manually trigger background jobs that normally run on a schedule",
          )}
        </p>
      </div>

      {Object.entries(tasksByService).map(([service, tasks]) => (
        <div key={service} className="mb-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
            <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded mr-2">
              {service}
            </span>
            {service === "svc-data"
              ? t("admin.tasks.dataService", "Market Data Service")
              : t("admin.tasks.eventService", "Corporate Events Service")}
          </h2>

          <div className="space-y-4">
            {tasks.map((task) => {
              const isRunning = runningTasks.has(task.id)
              const result = taskResults[task.id]

              return (
                <div
                  key={task.id}
                  className="bg-white rounded-lg border border-gray-200 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className="flex-shrink-0 w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                        <i
                          className={`fas ${task.icon} text-blue-500 text-lg`}
                        ></i>
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">
                          {task.name}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {task.description}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => runTask(task)}
                      disabled={isRunning}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isRunning
                          ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                          : "bg-blue-500 text-white hover:bg-blue-600"
                      }`}
                    >
                      {isRunning ? (
                        <>
                          <i className="fas fa-spinner fa-spin mr-2"></i>
                          {t("admin.tasks.running", "Running...")}
                        </>
                      ) : (
                        <>
                          <i className="fas fa-play mr-2"></i>
                          {t("admin.tasks.run", "Run")}
                        </>
                      )}
                    </button>
                  </div>

                  {result && (
                    <div
                      className={`mt-4 p-3 rounded-lg ${
                        result.success
                          ? "bg-green-50 border border-green-200"
                          : "bg-red-50 border border-red-200"
                      }`}
                    >
                      <div className="flex items-center">
                        <i
                          className={`fas ${
                            result.success
                              ? "fa-check-circle text-green-500"
                              : "fa-exclamation-circle text-red-500"
                          } mr-2`}
                        ></i>
                        <span
                          className={
                            result.success ? "text-green-700" : "text-red-700"
                          }
                        >
                          {result.message}
                        </span>
                      </div>
                      {result.data !== undefined && result.data !== null && (
                        <pre className="mt-2 text-xs text-gray-600 overflow-x-auto">
                          {JSON.stringify(result.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
})

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
})
