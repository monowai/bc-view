import { useParams } from "react-router-dom";
import ViewHoldings from "../../pages/holdings";
import { __new__ } from "../../core/types/constants";

export const RouteHoldings = (): JSX.Element => {
  const { portfolioId } = useParams<{
    portfolioId: string;
  }>();
  const pfId = portfolioId == undefined ? __new__ : portfolioId;
  return ViewHoldings(pfId);
};
