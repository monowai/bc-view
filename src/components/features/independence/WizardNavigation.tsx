import React from "react"

interface WizardNavigationProps {
  currentStep: number
  onBack: () => void
  onNext: () => void
  onCancel: () => void
  onSave?: () => void
  isSubmitting?: boolean
  isLastStep?: boolean
  isEditMode?: boolean
}

export default function WizardNavigation({
  currentStep,
  onBack,
  onNext,
  onCancel,
  onSave,
  isSubmitting = false,
  isLastStep = false,
  isEditMode = false,
}: WizardNavigationProps): React.ReactElement {
  return (
    <div className="flex justify-between items-center pt-4 border-t mt-5">
      <div>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700 font-medium"
        >
          Cancel
        </button>
      </div>
      <div className="flex space-x-4">
        {currentStep > 1 && (
          <button
            type="button"
            onClick={onBack}
            disabled={isSubmitting}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium disabled:opacity-50"
          >
            Back
          </button>
        )}
        {/* Show Save button in edit mode on any step */}
        {isEditMode && !isLastStep && onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={isSubmitting}
            className="px-6 py-2 border border-independence-600 text-independence-600 rounded-lg hover:bg-independence-50 font-medium disabled:opacity-50 flex items-center"
          >
            {isSubmitting && <i className="fas fa-spinner fa-spin mr-2"></i>}
            Save
          </button>
        )}
        <button
          type="button"
          onClick={isLastStep ? onSave || onNext : onNext}
          disabled={isSubmitting}
          className="px-6 py-2 bg-independence-600 text-white rounded-lg hover:bg-independence-700 font-medium disabled:opacity-50 flex items-center"
        >
          {isSubmitting && isLastStep && (
            <i className="fas fa-spinner fa-spin mr-2"></i>
          )}
          {isLastStep ? "Save Plan" : "Next"}
        </button>
      </div>
    </div>
  )
}
