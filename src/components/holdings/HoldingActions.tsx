import React, { useState } from "react";
import TradeInputForm from "@pages/trns/trade";
import CashInputForm from "@pages/trns/cash";
import { Portfolio } from "types/beancounter";

const HoldingActions: React.FC<{ portfolio: Portfolio }> = ({ portfolio }) => {
  const [tradeModalOpen, setTradeModalOpen] = useState(false);
  const [cashModalOpen, setCashModalOpen] = useState(false);

  return (
    <div className="flex flex-col sm:flex-row justify-end py-0 sm:py-2 space-y-2 sm:space-y-0 sm:space-x-2 mb-4">
      <button className="bg-blue-500 text-white px-4 py-1 rounded" onClick={() => setTradeModalOpen(true)}>
        Trade
      </button>
      <button className="bg-blue-500 text-white px-4 py-1 rounded" onClick={() => setCashModalOpen(true)}>
        Cash
      </button>
      <TradeInputForm portfolio={portfolio} modalOpen={tradeModalOpen} setModalOpen={setTradeModalOpen} />
      <CashInputForm portfolio={portfolio} modalOpen={cashModalOpen} setModalOpen={setCashModalOpen} />
    </div>
  );
};

export default HoldingActions;
