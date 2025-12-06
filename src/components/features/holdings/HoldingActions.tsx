import React, { useState, useEffect } from "react"
import TradeInputForm from "@pages/trns/trade"
import CashInputForm from "@pages/trns/cash"
import CopyPopup from "@components/ui/CopyPopup"
import { HoldingContract, QuickSellData } from "types/beancounter"

interface HoldingActionsProps {
  holdingResults: HoldingContract
  columns: string[]
  valueIn: string
  quickSellData?: QuickSellData
  onQuickSellHandled?: () => void
}

const HoldingActions: React.FC<HoldingActionsProps> = ({
  holdingResults,
  columns,
  valueIn,
  quickSellData,
  onQuickSellHandled,
}) => {
  const [tradeModalOpen, setTradeModalOpen] = useState(false)
  const [cashModalOpen, setCashModalOpen] = useState(false)
  const [copyModalOpen, setCopyModalOpen] = useState(false)

  // Open trade modal when quick sell data is provided
  useEffect(() => {
    if (quickSellData) {
      setTradeModalOpen(true)
    }
  }, [quickSellData])

  // Handle trade modal close
  const handleTradeModalClose = (open: boolean): void => {
    setTradeModalOpen(open)
    if (!open && onQuickSellHandled) {
      onQuickSellHandled()
    }
  }

  return (
    <div className="flex flex-col sm:flex-row justify-end py-2 space-y-2 sm:space-y-0 sm:space-x-2 mb-4">
      <button
        className="mobile-portrait:hidden w-full sm:w-auto bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center justify-center"
        onClick={() => setCopyModalOpen(true)}
      >
        <i className="fas fa-copy mr-2"></i>
        Copy Data
      </button>
      <button
        className="mobile-portrait:hidden w-full sm:w-auto bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center justify-center"
        onClick={() => setTradeModalOpen(true)}
      >
        <i className="fas fa-chart-line mr-2"></i>
        Add Trade
      </button>
      <button
        className="mobile-portrait:hidden w-full sm:w-auto bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center justify-center"
        onClick={() => setCashModalOpen(true)}
      >
        <i className="fas fa-dollar-sign mr-2"></i>
        Add Cash
      </button>
      <TradeInputForm
        portfolio={holdingResults.portfolio}
        modalOpen={tradeModalOpen}
        setModalOpen={handleTradeModalClose}
        initialValues={quickSellData}
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
