import React from "react"

export const OFFBOARDING_STEPS = [
  { id: 1, name: "Summary" },
  { id: 2, name: "Wealth" },
  { id: 3, name: "Planning" },
  { id: 4, name: "Account" },
]

interface OffboardingProgressProps {
  currentStep: number
}

export default function OffboardingProgress({
  currentStep,
}: OffboardingProgressProps): React.ReactElement {
  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="flex items-center justify-between">
        {OFFBOARDING_STEPS.map((step, index) => {
          const isCompleted = step.id < currentStep
          const isCurrent = step.id === currentStep
          const isUpcoming = step.id > currentStep

          return (
            <li key={step.id} className="flex-1 relative min-w-0">
              <div className="flex flex-col items-center relative z-10">
                <div
                  className={`
                    w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-xs sm:text-sm font-medium transition-all flex-shrink-0
                    ${isCompleted ? "bg-red-600 text-white" : ""}
                    ${isCurrent ? "bg-red-600 text-white ring-2 sm:ring-4 ring-red-200" : ""}
                    ${isUpcoming ? "bg-gray-200 text-gray-500" : ""}
                  `}
                >
                  {isCompleted ? (
                    <i className="fas fa-check text-xs"></i>
                  ) : (
                    step.id
                  )}
                </div>
                <span
                  className={`
                    mt-1 sm:mt-2 text-[10px] sm:text-xs font-medium transition-colors text-center truncate max-w-full px-1
                    ${isCurrent ? "text-red-600" : ""}
                    ${!isCurrent ? "text-gray-500" : ""}
                  `}
                >
                  <span className="hidden sm:inline">{step.name}</span>
                  <span className="sm:hidden">{step.id}</span>
                </span>
              </div>
              {index < OFFBOARDING_STEPS.length - 1 && (
                <div
                  className={`
                    absolute top-4 sm:top-5 left-1/2 w-full h-0.5 -translate-y-1/2
                    ${isCompleted ? "bg-red-600" : "bg-gray-200"}
                  `}
                />
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
