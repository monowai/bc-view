import React from "react"
import { BrokerWithAccounts } from "types/beancounter"
import Dialog from "@components/ui/Dialog"

interface BrokerSelectionDialogProps {
  held: Record<string, number>
  brokers: BrokerWithAccounts[]
  quantity: number
  onSelect: (brokerId: string, maxQty: number) => void
  onSkip: () => void
}

const BrokerSelectionDialog: React.FC<BrokerSelectionDialogProps> = ({
  held,
  brokers,
  quantity,
  onSelect,
  onSkip,
}) => (
  <Dialog title="Select Broker" onClose={onSkip} maxWidth="md">
    <p className="text-sm text-gray-600">
      This position is held across multiple brokers. Select which broker to sell
      from:
    </p>
    <div className="space-y-2">
      {Object.entries(held).map(([brokerName, qty]) => {
        const broker = brokers.find((b) => b.name === brokerName)
        return (
          <button
            key={brokerName}
            type="button"
            onClick={() => onSelect(broker?.id || "", Math.min(quantity, qty))}
            className="w-full p-3 text-left border rounded hover:bg-gray-50 flex justify-between items-center"
          >
            <span className="font-medium">{brokerName}</span>
            <span className="text-gray-500">
              {qty.toLocaleString()} {"shares"}
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
      {"Skip - sell without specifying broker"}
    </button>
  </Dialog>
)

export default BrokerSelectionDialog
