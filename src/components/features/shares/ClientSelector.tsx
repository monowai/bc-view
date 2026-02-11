import React, { useState, useEffect } from "react"
import { useTranslation } from "next-i18next"

interface ClientSelectorProps {
  clientId: string
  onChange: (clientId: string) => void
}

/**
 * Shared component for selecting a client when creating resources on behalf of.
 * Used by both Independence Plan and Rebalance Model creation flows.
 */
const ClientSelector: React.FC<ClientSelectorProps> = ({
  clientId,
  onChange,
}) => {
  const { t } = useTranslation("common")
  const [isEnabled, setIsEnabled] = useState(clientId !== "")

  useEffect(() => {
    setIsEnabled(clientId !== "")
  }, [clientId])

  const handleToggle = (): void => {
    if (isEnabled) {
      onChange("")
    }
    setIsEnabled(!isEnabled)
  }

  const labelId = "clientSelectorLabel"

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div className="flex items-center gap-3">
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={isEnabled}
            onChange={handleToggle}
            className="sr-only peer"
            aria-labelledby={labelId}
          />
          <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
        </label>
        <span id={labelId} className="text-sm font-medium text-gray-700">
          {t("client.createFor", "Create on behalf of a client")}
        </span>
      </div>
      {isEnabled && (
        <div className="mt-3">
          <label
            htmlFor="clientEmail"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {t("client.email", "Client Email")}
          </label>
          <input
            id="clientEmail"
            type="email"
            value={clientId}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t(
              "client.email.placeholder",
              "Enter client's email address",
            )}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="mt-1 text-xs text-gray-500">
            {t(
              "client.email.hint",
              "The client must have shared their portfolios with you.",
            )}
          </p>
        </div>
      )}
    </div>
  )
}

export default ClientSelector
