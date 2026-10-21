import React from "react"

interface Step {
  id: number
  label: string
}

interface OnboardingProgressProps {
  currentStep: number
  steps: Step[]
}

const OnboardingProgress: React.FC<OnboardingProgressProps> = ({
  currentStep,
  steps,
}) => {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            {/* Step circle */}
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                  step.id < currentStep
                    ? "bg-green-500 text-white"
                    : step.id === currentStep
                      ? "bg-blue-500 text-white"
                      : "bg-gray-200 text-gray-500"
                }`}
              >
                {step.id < currentStep ? (
                  <i className="fas fa-check"></i>
                ) : (
                  step.id
                )}
              </div>
              <span
                className={`mt-2 text-xs text-center ${
                  step.id === currentStep
                    ? "text-blue-600 font-medium"
                    : "text-gray-500"
                }`}
              >
                {step.label}
              </span>
            </div>

            {/* Connector line */}
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-1 mx-2 ${
                  step.id < currentStep ? "bg-green-500" : "bg-gray-200"
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

export default OnboardingProgress
