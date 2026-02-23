import React from "react"
interface PlanningStepProps {
  planCount: number
  modelCount: number
  deletePlans: boolean
  setDeletePlans: (value: boolean) => void
  deleteModels: boolean
  setDeleteModels: (value: boolean) => void
  onBack: () => void
  onNext: () => void
}

export default function PlanningStep({
  planCount,
  modelCount,
  deletePlans,
  setDeletePlans,
  deleteModels,
  setDeleteModels,
  onBack,
  onNext,
}: PlanningStepProps): React.ReactElement {
  const hasData = planCount > 0 || modelCount > 0

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        {"Delete Planning Data"}
      </h2>
      <p className="text-gray-600 mb-6">
        {
          "Your planning data includes retirement plans and model portfolios for rebalancing."
        }
      </p>

      {hasData ? (
        <div className="space-y-4 mb-6">
          {planCount > 0 && (
            <div className="border border-gray-200 rounded-lg p-4">
              <label className="flex items-start cursor-pointer">
                <input
                  type="checkbox"
                  checked={deletePlans}
                  onChange={(e) => setDeletePlans(e.target.checked)}
                  className="mt-1 h-5 w-5 text-red-600 rounded border-gray-300 focus:ring-red-500"
                />
                <div className="ml-3">
                  <div className="flex items-center">
                    <i className="fas fa-chart-line text-purple-500 mr-2"></i>
                    <span className="font-medium text-gray-900">
                      {`Delete all ${planCount} retirement plans`}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {
                      "This will delete your independence plans and their expense breakdowns."
                    }
                  </p>
                </div>
              </label>
            </div>
          )}

          {modelCount > 0 && (
            <div className="border border-gray-200 rounded-lg p-4">
              <label className="flex items-start cursor-pointer">
                <input
                  type="checkbox"
                  checked={deleteModels}
                  onChange={(e) => setDeleteModels(e.target.checked)}
                  className="mt-1 h-5 w-5 text-red-600 rounded border-gray-300 focus:ring-red-500"
                />
                <div className="ml-3">
                  <div className="flex items-center">
                    <i className="fas fa-balance-scale text-indigo-500 mr-2"></i>
                    <span className="font-medium text-gray-900">
                      {`Delete all ${modelCount} model portfolios`}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    {
                      "This will delete your rebalancing models and their allocation plans."
                    }
                  </p>
                </div>
              </label>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <i className="fas fa-info-circle text-gray-400 mr-3"></i>
            <p className="text-gray-600">
              {
                "You don't have any retirement plans or model portfolios to delete."
              }
            </p>
          </div>
        </div>
      )}

      {(deletePlans || deleteModels) && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <i className="fas fa-exclamation-circle text-red-500 mr-3 mt-1"></i>
            <div>
              <p className="text-red-700 font-medium">
                {"This action is irreversible"}
              </p>
              <p className="text-red-600 text-sm mt-1">
                {
                  "Your retirement plans and rebalancing models will be permanently deleted."
                }
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={onBack}
          className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
        >
          {"Back"}
        </button>
        <button
          onClick={onNext}
          className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          {"Continue"}
        </button>
      </div>
    </div>
  )
}
