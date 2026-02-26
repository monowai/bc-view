import React from "react"
import Spinner from "@components/ui/Spinner"
interface ConfirmAccountStepProps {
  deleteAccount: boolean
  setDeleteAccount: (value: boolean) => void
  onBack: () => void
  onDelete: () => void
  isDeleting: boolean
  hasSelections: boolean
}

export default function ConfirmAccountStep({
  deleteAccount,
  setDeleteAccount,
  onBack,
  onDelete,
  isDeleting,
  hasSelections,
}: ConfirmAccountStepProps): React.ReactElement {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        {"Delete Account"}
      </h2>
      <p className="text-gray-600 mb-6">
        {
          "Optionally, you can delete your entire Beancounter account. This will remove all your data and log you out."
        }
      </p>

      <div className="border border-gray-200 rounded-lg p-4 mb-6">
        <label className="flex items-start cursor-pointer">
          <input
            type="checkbox"
            checked={deleteAccount}
            onChange={(e) => setDeleteAccount(e.target.checked)}
            className="mt-1 h-5 w-5 text-red-600 rounded border-gray-300 focus:ring-red-500"
          />
          <div className="ml-3">
            <span className="font-medium text-gray-900">
              {"Delete my entire account"}
            </span>
            <p className="text-sm text-gray-500 mt-1">
              {
                "This will delete all your data including portfolios, assets, plans, models, preferences, and your user account."
              }
            </p>
          </div>
        </label>
      </div>

      {deleteAccount && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <i className="fas fa-exclamation-circle text-red-500 mr-3 mt-1"></i>
            <div>
              <p className="text-red-700 font-medium">
                {"Complete account deletion"}
              </p>
              <p className="text-red-600 text-sm mt-1">
                {
                  "Your account will be permanently deleted. You will be logged out and will need to register again to use Beancounter."
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {!hasSelections && !deleteAccount && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <i className="fas fa-info-circle text-yellow-500 mr-3"></i>
            <p className="text-yellow-700">
              {
                "Please select at least one item to delete, or delete your entire account."
              }
            </p>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={onBack}
          disabled={isDeleting}
          className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50"
        >
          {"Back"}
        </button>
        <button
          onClick={onDelete}
          disabled={isDeleting || (!hasSelections && !deleteAccount)}
          className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isDeleting ? (
            <>
              <Spinner className="mr-2" />
              {"Deleting..."}
            </>
          ) : (
            <>
              <i className="fas fa-trash-alt mr-2"></i>
              {"Delete Selected"}
            </>
          )}
        </button>
      </div>
    </div>
  )
}
