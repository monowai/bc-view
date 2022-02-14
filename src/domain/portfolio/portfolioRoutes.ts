import { useParams } from "react-router-dom";
import { Edit } from "../../pages/portfolio/Edit";
import { Delete } from "../../pages/portfolio/Delete";
import { __new__ } from "../../core/types/constants";

export const RoutePortfolio = (): JSX.Element => {
  const { portfolioId } = useParams<{
    portfolioId: string;
  }>();
  const pfId = portfolioId == undefined ? __new__ : portfolioId;
  return Edit(pfId);
};
export const RoutePortfolioDelete = (): JSX.Element => {
  const { portfolioId } = useParams<{
    portfolioId: string;
  }>();
  const pfId = portfolioId == undefined ? __new__ : portfolioId;
  return Delete(pfId);
};
