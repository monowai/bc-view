import { Portfolio } from "types/beancounter";
import { getTradeRow } from "@utils/trns/tradeUtils";

export const onSubmit = (portfolio: Portfolio, errors: any, data: any, setTradeModalOpen: (open: boolean) => void): void => {
  if (Object.keys(errors).length > 0) {
    console.log("Validation errors:", errors);
    return;
  }
  const row = getTradeRow(data);
  if (window.confirm(`Do you want to submit the transaction?`)) {
    postData(portfolio, false, row.split(",")).then(console.log);
    setTradeModalOpen(false);
  } else {
    console.log("Transaction submission canceled");
  }
};
