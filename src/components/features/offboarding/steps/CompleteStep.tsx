import React from "react"
import Alert from "@components/ui/Alert"
import { OffboardingResult } from "types/beancounter"
import Link from "next/link"
import { forceLogout } from "@utils/offboarding"

interface CompleteStepProps {
  results: OffboardingResult[]
  accountDeleted: boolean
}

export default function CompleteStep({
  results,
  accountDeleted,
}: CompleteStepProps): React.ReactElement {
  const hasFailures = results.some((r) => !r.success)

  // Force logout once the account is closed. The session is dead server-side
  // (the user is deactivated), so don't leave them sitting in a stale app —
  // redirect to the Auth0 logout flow after a short beat so they see the
  // confirmation. Full-page navigation is required for Auth0 logout.
  React.useEffect(() => {
    if (!accountDeleted) return undefined
    const timer = setTimeout(forceLogout, 3000)
    return () => clearTimeout(timer)
  }, [accountDeleted])

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="text-center mb-6">
        <div
          className={`w-16 h-16 ${hasFailures ? "bg-red-100" : "bg-green-100"} rounded-full flex items-center justify-center mx-auto mb-4`}
        >
          <i
            className={`fas ${hasFailures ? "fa-exclamation-circle text-2xl text-red-600" : "fa-check text-2xl text-green-600"}`}
          ></i>
        </div>
        <h2 className="text-xl font-semibold text-gray-900">
          {hasFailures ? "Deletion Partially Failed" : "Deletion Complete"}
        </h2>
        <p className="text-gray-600 mt-2">
          {hasFailures
            ? "Some items could not be deleted. Please retry or contact support."
            : "The selected data has been successfully removed from Beancounter."}
        </p>
      </div>

      {hasFailures && (
        <Alert variant="error" className="mb-6">
          <div className="flex items-start">
            <i className="fas fa-exclamation-circle text-red-500 mr-3 mt-1"></i>
            <p className="text-red-700 text-sm">
              {
                "One or more deletions failed. Your data may be partially deleted. Please retry or contact support if the issue persists."
              }
            </p>
          </div>
        </Alert>
      )}

      <div className="space-y-4 mb-8">
        {results.map((result, index) => (
          <div
            key={index}
            className={`flex items-center justify-between p-4 rounded-lg ${
              result.success ? "bg-green-50" : "bg-red-50"
            }`}
          >
            <div className="flex items-center">
              <i
                className={`fas ${result.success ? "fa-check-circle text-green-500" : "fa-times-circle text-red-500"} mr-3`}
              ></i>
              <span className="font-medium capitalize">{result.type}</span>
            </div>
            <span className="text-gray-600">
              {result.deletedCount} {"deleted"}
            </span>
          </div>
        ))}
      </div>

      {accountDeleted ? (
        <div className="text-center">
          <p className="text-gray-600 mb-4">
            {
              "Your account has been closed and your data removed. Logging you out… Sign in again any time to reactivate it."
            }
          </p>
          {/* Using <a> intentionally - /auth/logout requires full page navigation for Auth0 logout flow */}
          <a
            href="/auth/logout"
            className="inline-flex items-center px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <i className="fas fa-sign-out-alt mr-2"></i>
            {"Log Out Now"}
          </a>
        </div>
      ) : (
        <div className="text-center">
          <Link
            href="/"
            className="inline-flex items-center px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
          >
            <i className="fas fa-home mr-2"></i>
            {"Return Home"}
          </Link>
        </div>
      )}
    </div>
  )
}
