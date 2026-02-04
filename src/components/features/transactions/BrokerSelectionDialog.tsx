import React from "react"
import { BrokerWithAccounts } from "types/beancounter"

interface BrokerSelectionDialogProps {
  held: Record<string, number>
  brokers: BrokerWithAccounts[]
  quantity: number
  onSelect: (brokerId: string, maxQty: number) => void
  onSkip: () => void
  t: any
}

const BrokerSelectionDialog: React.FC<BrokerSelectionDialogProps> = ({
  held,
  brokers,
  quantity,
  onSelect,
  onSkip,
  t,
}) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center">
    <div
      className="fixed inset-0 bg-black opacity-50"
      onClick={onSkip}
    ></div>
    <div
      className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 p-6 z-[60]"
      onClick={(e) => e.stopPropagation()}
    >
      <h3 className="text-lg font-semibold mb-2">
        {t("trn.broker.select", "Select Broker")}
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        {t(
          "trn.broker.multipleHeld",
          "This position is held across multiple brokers. Select which broker to sell from:",
        )}
      </p>
      <div className="space-y-2">
        {Object.entries(held).map(([brokerName, qty]) => {
          const broker = brokers.find((b) => b.name === brokerName)
          return (
            <button
              key={brokerName}
              type="button"
              onClick={() => {
                onSelect(broker?.id || "", Math.min(quantity, qty))
              }}
              className="w-full p-3 text-left border rounded hover:bg-gray-50 flex justify-between items-center"
            >
              <span className="font-medium">{brokerName}</span>
              <span className="text-gray-500">
                {qty.toLocaleString()} {t("trn.shares", "shares")}
              </span>
            </button>
          )
        })}
      </div>
      <button
        type="button"
        className="w-full mt-4 p-2 text-gray-500 hover:text-gray-700 text-sm"
        onClick={onSkip}
      >
        {t(
          "trn.broker.skipSelection",
          "Skip - sell without specifying broker",
        )}
      </button>
    </div>
  </div>
)

export default BrokerSelectionDialog
