import React, { useState } from "react"
import TradeInputForm from "@pages/trns/trade"
import CashInputForm from "@pages/trns/cash"
import CopyPopup from "@components/CopyPopup"
import { HoldingContract } from "types/beancounter"

interface HoldingActionsProps {
  holdingResults: HoldingContract
  columns: string[]
  valueIn: string
}

const HoldingActions: React.FC<HoldingActionsProps> = ({
  holdingResults,
  columns,
  valueIn,
}) => {
  const [tradeModalOpen, setTradeModalOpen] = useState(false)
  const [cashModalOpen, setCashModalOpen] = useState(false)
  const [copyModalOpen, setCopyModalOpen] = useState(false)

  return (
    <div className="flex flex-col sm:flex-row justify-end py-0 sm:py-2 space-y-2 sm:space-y-0 sm:space-x-2 mb-4">
      <button
        className="bg-blue-500 text-white px-4 py-1 rounded"
        onClick={() => setCopyModalOpen(true)}
      >
        Copy
      </button>
      <button
        className="bg-blue-500 text-white px-4 py-1 rounded"
        onClick={() => setTradeModalOpen(true)}
      >
        Trade
      </button>
      <button
        className="bg-blue-500 text-white px-4 py-1 rounded"
        onClick={() => setCashModalOpen(true)}
      >
        Cash
      </button>
      <TradeInputForm
        portfolio={holdingResults.portfolio}
        modalOpen={tradeModalOpen}
        setModalOpen={setTradeModalOpen}
      />
      <CashInputForm
        portfolio={holdingResults.portfolio}
        modalOpen={cashModalOpen}
        setModalOpen={setCashModalOpen}
      />
      <CopyPopup
        columns={columns}
        data={holdingResults.positions}
        valueIn={valueIn}
        modalOpen={copyModalOpen}
        onClose={() => setCopyModalOpen(false)}
      />
    </div>
  )
}

export default HoldingActions
