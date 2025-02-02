import React from "react";
import TradeInputForm from "@pages/trns/trade";
import CashInputForm from "@pages/trns/cash";
import { Portfolio } from "types/beancounter";

const HoldingActions: React.FC<{ portfolio: Portfolio }> = ({ portfolio }) => {
  return (
    <div className="flex justify-end py-1">
      <TradeInputForm portfolio={portfolio} />
      <CashInputForm portfolio={portfolio} />
    </div>
  );
};

export default HoldingActions;
