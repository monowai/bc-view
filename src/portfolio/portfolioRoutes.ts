import { useParams } from "react-router-dom";
import { PortfolioEdit } from "./PortfolioEdit";
import { DeletePortfolio } from "./DeletePortfolio";
import { __new__ } from "../types/constants";

export const RoutePortfolio = (): JSX.Element => {
  const { portfolioId } =
    useParams<{
      portfolioId: string;
    }>();
  const pfId = portfolioId == undefined ? __new__ : portfolioId;
  return PortfolioEdit(pfId);
};
export const RoutePortfolioDelete = (): JSX.Element => {
  const { portfolioId } =
    useParams<{
      portfolioId: string;
    }>();
  const pfId = portfolioId == undefined ? __new__ : portfolioId;
  return DeletePortfolio(pfId);
};
