import React from "react"
import Link from "next/link"
import Alert from "@components/ui/Alert"

function DeniedPanel({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div className="max-w-4xl mx-auto py-12 px-4">
      <Alert variant="error" className="p-6 text-center">
        {children}
      </Alert>
    </div>
  )
}

/**
 * The panel a non-admin sees. It only renders the refusal: each page keeps its
 * own `isAdmin` check, which is what stops the page rendering.
 */
export default function AdminAccessDenied({
  returnHref = "/portfolios",
  returnLabel = "Return to Portfolios",
}: {
  returnHref?: string
  returnLabel?: string
}): React.ReactElement {
  return (
    <DeniedPanel>
      <i className="fas fa-lock text-4xl text-red-400 mb-4"></i>
      <h1 className="text-xl font-semibold text-red-700 mb-2">
        {"Access Denied"}
      </h1>
      <p className="text-red-600">
        {"You do not have permission to access the admin area."}
      </p>
      <Link
        href={returnHref}
        className="inline-block mt-4 px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition-colors"
      >
        {returnLabel}
      </Link>
    </DeniedPanel>
  )
}

/** Heading-only refusal, for the operational pages with no way back. */
export function BareAdminAccessDenied(): React.ReactElement {
  return (
    <DeniedPanel>
      <h1 className="text-xl font-semibold text-red-700">Access Denied</h1>
    </DeniedPanel>
  )
}
