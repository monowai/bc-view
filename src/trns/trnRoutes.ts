import { useParams } from "react-router-dom";
import Events from "./Events";
import { TransactionEdit } from "./TransactionEdit";
import Trades from "./Trades";
import { __new__ } from "../types/constants";

export const RouteTradeList = (): JSX.Element => {
  const { portfolioId, assetId } =
    useParams<{
      portfolioId: string;
      assetId: string;
    }>();
  const portfolio = portfolioId == undefined ? __new__ : portfolioId;
  const asset = assetId == undefined ? __new__ : assetId;
  return Trades(portfolio, asset);
};
export const RouteEventList = (): JSX.Element => {
  const { portfolioId, assetId } =
    useParams<{
      portfolioId: string;
      assetId: string;
    }>();
  const portfolio = portfolioId == undefined ? __new__ : portfolioId;
  const asset = assetId == undefined ? __new__ : assetId;
  return Events(portfolio, asset);
};
export const RouteTrnEdit = (): JSX.Element => {
  const { portfolioId, trnId } =
    useParams<{
      portfolioId: string;
      trnId: string;
    }>();
  const pId = portfolioId == undefined ? __new__ : portfolioId;
  const tId = trnId == undefined ? __new__ : trnId;
  return TransactionEdit(pId, tId);
};