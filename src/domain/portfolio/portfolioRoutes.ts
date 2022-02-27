import { useParams } from "react-router-dom";
import { Manage } from "../../pages/portfolio/Manage";
import { Delete } from "../../pages/portfolio/Delete";
import { __new__ } from "../../core/types/constants";

export const RoutePortfolio = (): JSX.Element => {
  const { portfolioId } = useParams<{
    portfolioId: string;
  }>();
  const pfId = portfolioId == undefined ? __new__ : portfolioId;
  return Manage(pfId);
};
export const RoutePortfolioDelete = (): JSX.Element => {
  const { portfolioId } = useParams<{
    portfolioId: string;
  }>();
  const pfId = portfolioId == undefined ? __new__ : portfolioId;
  return Delete(pfId);
};
