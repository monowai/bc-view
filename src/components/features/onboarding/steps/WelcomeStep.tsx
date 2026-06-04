import React from "react"

interface WelcomeStepProps {
  preferredName: string
  onPreferredNameChange: (name: string) => void
}

// Compact Welcome step — single screen, no scroll on a 800x600 viewport.
// Icon dropped, vertical paddings tightened, "what we'll cover" inlined
// as a one-line summary rather than a full panel.
const WelcomeStep: React.FC<WelcomeStepProps> = ({
  preferredName,
  onPreferredNameChange,
}) => {
  return (
    <div className="py-2">
      <div className="max-w-sm mb-4">
        <label
          htmlFor="preferredName"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {"What should we call you?"}
        </label>
        <input
          type="text"
          id="preferredName"
          value={preferredName}
          onChange={(e) => onPreferredNameChange(e.target.value)}
          placeholder={"Your first name"}
          className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="text-xs text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
        <span>
          <i className="fas fa-dollar-sign text-blue-500 mr-1"></i>Currency
        </span>
        <span>
          <i className="fas fa-folder text-blue-500 mr-1"></i>Portfolio
        </span>
        <span>
          <i className="fas fa-university text-blue-500 mr-1"></i>Bank accounts
          &amp; property
        </span>
        <span>
          <i className="fas fa-building-columns text-purple-500 mr-1"></i>
          Brokerage
        </span>
      </div>
    </div>
  )
}

export default WelcomeStep
