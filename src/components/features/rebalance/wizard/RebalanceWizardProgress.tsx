import React from "react"
import { useTranslation } from "next-i18next"

interface Step {
  id: number
  label: string
}

interface RebalanceWizardProgressProps {
  currentStep: number
  steps: Step[]
}

const RebalanceWizardProgress: React.FC<RebalanceWizardProgressProps> = ({
  currentStep,
  steps,
}) => {
  const { t } = useTranslation("common")

  return (
    <div className="mb-8">
      {/* Mobile view - simple text */}
      <div className="sm:hidden text-center text-gray-600">
        {t("rebalance.wizard.stepOf", "Step {{current}} of {{total}}", {
          current: currentStep,
          total: steps.length,
        })}
        <div className="font-medium text-gray-900 mt-1">
          {steps[currentStep - 1]?.label}
        </div>
      </div>

      {/* Desktop view - full stepper */}
      <div className="hidden sm:flex items-center justify-center">
        {steps.map((step, index) => (
          <React.Fragment key={step.id}>
            <div className="flex items-center">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                  currentStep > step.id
                    ? "bg-green-500 border-green-500 text-white"
                    : currentStep === step.id
                      ? "bg-blue-500 border-blue-500 text-white"
                      : "bg-white border-gray-300 text-gray-500"
                }`}
              >
                {currentStep > step.id ? (
                  <i className="fas fa-check text-sm"></i>
                ) : (
                  step.id
                )}
              </div>
              <span
                className={`ml-2 text-sm font-medium ${
                  currentStep >= step.id ? "text-gray-900" : "text-gray-500"
                }`}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`w-12 h-0.5 mx-4 ${
                  currentStep > step.id ? "bg-green-500" : "bg-gray-300"
                }`}
              ></div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

export default RebalanceWizardProgress
