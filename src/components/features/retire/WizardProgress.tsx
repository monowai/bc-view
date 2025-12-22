import React from "react"
import { WIZARD_STEPS } from "@lib/retire/stepConfig"

interface WizardProgressProps {
  currentStep: number
  isEditMode?: boolean
  stepErrors?: Set<number>
  onStepClick?: (step: number) => void
}

export default function WizardProgress({
  currentStep,
  isEditMode = false,
  stepErrors = new Set(),
  onStepClick,
}: WizardProgressProps): React.ReactElement {
  const handleStepClick = (stepId: number): void => {
    if (isEditMode && onStepClick) {
      onStepClick(stepId)
    }
  }

  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="flex items-center justify-between">
        {WIZARD_STEPS.map((step, index) => {
          const isCompleted = step.id < currentStep
          const isCurrent = step.id === currentStep
          const isUpcoming = step.id > currentStep
          const hasError = stepErrors.has(step.id)
          const isClickable = isEditMode && onStepClick

          return (
            <li key={step.id} className="flex-1 relative">
              <div
                className={`flex flex-col items-center relative z-10 ${isClickable ? "cursor-pointer" : ""}`}
                onClick={() => handleStepClick(step.id)}
                role={isClickable ? "button" : undefined}
                tabIndex={isClickable ? 0 : undefined}
                onKeyDown={(e) => {
                  if (isClickable && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault()
                    handleStepClick(step.id)
                  }
                }}
              >
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all
                    ${hasError ? "bg-red-500 text-white ring-4 ring-red-200" : ""}
                    ${!hasError && isCompleted ? "bg-orange-600 text-white" : ""}
                    ${!hasError && isCurrent ? "bg-orange-600 text-white ring-4 ring-orange-200" : ""}
                    ${!hasError && isUpcoming ? "bg-gray-200 text-gray-500" : ""}
                    ${isClickable && !isCurrent ? "hover:ring-2 hover:ring-orange-300" : ""}
                  `}
                >
                  {hasError ? (
                    <i className="fas fa-exclamation"></i>
                  ) : isCompleted ? (
                    <i className="fas fa-check"></i>
                  ) : (
                    step.id
                  )}
                </div>
                <span
                  className={`
                    mt-2 text-xs font-medium transition-colors
                    ${hasError ? "text-red-600" : ""}
                    ${!hasError && isCurrent ? "text-orange-600" : ""}
                    ${!hasError && !isCurrent ? "text-gray-500" : ""}
                    ${isClickable ? "hover:text-orange-600" : ""}
                  `}
                >
                  {step.name}
                </span>
              </div>
              {index < WIZARD_STEPS.length - 1 && (
                <div
                  className={`
                    absolute top-5 left-1/2 w-full h-0.5 -translate-y-1/2
                    ${isCompleted && !stepErrors.has(step.id + 1) ? "bg-orange-600" : "bg-gray-200"}
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
