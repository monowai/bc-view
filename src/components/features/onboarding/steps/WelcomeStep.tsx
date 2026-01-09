import React from "react"
import { useTranslation } from "next-i18next"

interface WelcomeStepProps {
  preferredName: string
  onPreferredNameChange: (name: string) => void
}

const WelcomeStep: React.FC<WelcomeStepProps> = ({
  preferredName,
  onPreferredNameChange,
}) => {
  const { t } = useTranslation("onboarding")

  return (
    <div className="text-center py-6">
      <div className="text-5xl mb-6">
        <i className="fas fa-chart-line text-blue-500"></i>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-4">
        {t("welcome.title", "Welcome to Beancounter!")}
      </h2>

      <p className="text-gray-600 mb-6 max-w-md mx-auto">
        {t(
          "welcome.description",
          "Let's set up your account in a few quick steps. We'll help you create your first portfolio and add your accounts.",
        )}
      </p>

      {/* Preferred Name Input */}
      <div className="max-w-sm mx-auto mb-6">
        <label
          htmlFor="preferredName"
          className="block text-sm font-medium text-gray-700 mb-2 text-left"
        >
          {t("welcome.nameLabel", "What should we call you?")}
        </label>
        <input
          type="text"
          id="preferredName"
          value={preferredName}
          onChange={(e) => onPreferredNameChange(e.target.value)}
          placeholder={t("welcome.namePlaceholder", "Your first name")}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <p className="text-sm text-gray-500 mt-1 text-left">
          {t(
            "welcome.nameHint",
            "This is how we'll greet you throughout the app.",
          )}
        </p>
      </div>

      <div className="bg-gray-50 rounded-lg p-4 max-w-sm mx-auto">
        <h3 className="font-medium text-gray-900 mb-3">
          {t("welcome.whatWellCover", "What we'll cover:")}
        </h3>
        <ul className="text-left text-gray-600 space-y-2">
          <li className="flex items-center">
            <i className="fas fa-dollar-sign text-blue-500 w-5 mr-2"></i>
            {t("welcome.step1", "Choose your base currency")}
          </li>
          <li className="flex items-center">
            <i className="fas fa-folder text-blue-500 w-5 mr-2"></i>
            {t("welcome.step2", "Create your first portfolio")}
          </li>
          <li className="flex items-center">
            <i className="fas fa-university text-blue-500 w-5 mr-2"></i>
            {t("welcome.step3", "Add your bank accounts & property")}
          </li>
        </ul>
      </div>

      <p className="text-sm text-gray-500 mt-6">
        {t(
          "welcome.skipNote",
          "You can skip this setup and complete it later from settings.",
        )}
      </p>
    </div>
  )
}

export default WelcomeStep
