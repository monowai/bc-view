import React from "react"
import Link from "next/link"
interface CompleteStepProps {
  portfolioName: string
  bankAccountCount: number
  propertyCount: number
  pensionCount: number
  insuranceCount: number
  portfolioId: string | null
  independencePlanCreated?: boolean
  brokerageCreated?: boolean
}

// Compact "you're all set" — single screen. Summary as horizontal chips,
// next-step pointers side-by-side, no oversized icon header.
const CompleteStep: React.FC<CompleteStepProps> = ({
  portfolioName,
  bankAccountCount,
  propertyCount,
  pensionCount,
  insuranceCount,
  independencePlanCreated,
  brokerageCreated,
}) => {
  const chips: Array<{ icon: string; color: string; label: string }> = [
    { icon: "fa-folder", color: "text-blue-500", label: portfolioName },
    ...(bankAccountCount > 0
      ? [
          {
            icon: "fa-university",
            color: "text-blue-500",
            label: `${bankAccountCount} bank account${bankAccountCount === 1 ? "" : "s"}`,
          },
        ]
      : []),
    ...(propertyCount > 0
      ? [
          {
            icon: "fa-home",
            color: "text-green-500",
            label: `${propertyCount} propert${propertyCount === 1 ? "y" : "ies"}`,
          },
        ]
      : []),
    ...(pensionCount > 0
      ? [
          {
            icon: "fa-piggy-bank",
            color: "text-purple-500",
            label: `${pensionCount} pension${pensionCount === 1 ? "" : "s"}`,
          },
        ]
      : []),
    ...(insuranceCount > 0
      ? [
          {
            icon: "fa-shield-alt",
            color: "text-teal-500",
            label: `${insuranceCount} insurance${insuranceCount === 1 ? "" : " policies"}`,
          },
        ]
      : []),
    ...(brokerageCreated
      ? [
          {
            icon: "fa-building-columns",
            color: "text-purple-500",
            label: "Brokerage set up",
          },
        ]
      : []),
  ]

  return (
    <div className="py-2">
      <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 mb-1">
        <i className="fas fa-check-circle text-green-500"></i>
        {"You're all set!"}
      </h2>
      <p className="text-sm text-gray-600 mb-3">{"Created:"}</p>

      {/* Horizontal summary chips */}
      <div className="flex flex-wrap gap-2 mb-4">
        {chips.map((c, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-xs text-gray-700"
          >
            <i className={`fas ${c.icon} ${c.color}`}></i>
            {c.label}
          </span>
        ))}
        {independencePlanCreated && (
          <Link
            href="/independence"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-independence-50 text-xs text-independence-700 hover:bg-independence-100"
          >
            <i className="fas fa-chart-line text-independence-500"></i>
            {"Independence Plan"}
            <i className="fas fa-arrow-right text-[10px]"></i>
          </Link>
        )}
      </div>

      {/* Next-step pointers — side-by-side, compact */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm">
          <div className="font-semibold text-gray-900 flex items-center gap-1.5 mb-1">
            <i className="fas fa-building-columns text-purple-500"></i>
            {"More brokerage accounts"}
          </div>
          <p className="text-xs text-gray-600">
            {"Use "}
            <strong>Tools → Open Brokerage</strong>
            {" any time to add another broker."}
          </p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
          <div className="font-semibold text-gray-900 flex items-center gap-1.5 mb-1">
            <i className="fas fa-coins text-blue-500"></i>
            {"Other assets"}
          </div>
          <p className="text-xs text-gray-600">
            {"Use the "}
            <strong>Wealth</strong>
            {
              " menu to record assets BC doesn't natively support — collectibles, alt-investments, anything off-market."
            }
          </p>
        </div>
      </div>
    </div>
  )
}

export default CompleteStep
