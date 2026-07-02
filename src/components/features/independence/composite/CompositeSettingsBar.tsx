import React from "react"
import { useCompositeProjectionContext } from "./CompositeProjectionContext"

export default function CompositeSettingsBar(): React.ReactElement {
  const { projection, compositeNarrative, setCompositeNarrative } =
    useCompositeProjectionContext()

  const sustainabilityText = projection
    ? projection.isSustainable
      ? `Sustainable to age ${projection.yearlyProjections[projection.yearlyProjections.length - 1]?.age ?? "?"}`
      : `Depletes at age ${projection.depletionAge ?? "?"}`
    : null

  return (
    <div className="bg-white rounded-xl shadow-md p-4">
      <div className="flex flex-col md:flex-row md:items-start md:gap-6">
        <div className="flex flex-wrap items-center gap-4 md:flex-1">
          {sustainabilityText && (
            <span
              className={`text-sm font-medium px-3 py-1 rounded-full ${
                projection?.isSustainable
                  ? "bg-green-100 text-green-700"
                  : "bg-red-100 text-red-700"
              }`}
            >
              <i
                className={`fas ${projection?.isSustainable ? "fa-check-circle" : "fa-exclamation-triangle"} mr-1`}
              ></i>
              {sustainabilityText}
            </span>
          )}
        </div>

        <div className="mt-4 md:mt-0 md:w-1/2 md:max-w-md">
          <label
            htmlFor="composite-narrative"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Composite plan narrative
            <span className="ml-1 text-xs font-normal text-gray-500">
              (optional)
            </span>
          </label>
          <textarea
            id="composite-narrative"
            value={compositeNarrative ?? ""}
            onChange={(e) => setCompositeNarrative(e.target.value)}
            rows={4}
            placeholder="Tell us about the overarching goal of your plans. This serves as a prompt to AI tools to understand your strategy, goals and asperations."
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-independence-500 focus:border-independence-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            Applies across all phases. The AI assistant reads this for
            cross-plan context.
          </p>
        </div>
      </div>
    </div>
  )
}
