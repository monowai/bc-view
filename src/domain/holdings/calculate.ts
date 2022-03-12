import { HoldingContract, Holdings, MoneyValues, Position } from "../../core/types/beancounter";
import { GroupBy } from "../../core/types/groupBy";
import { ValueIn } from "../../core/types/constants";
import { isCash } from "../assets/assetUtils";

function getPath(path: string, position: Position): string {
  return path
    .split(".")
    .reduce((p, path: string) => (p && p[path]) || "undefined", position) as unknown as string;
}

function total(total: MoneyValues, position: Position, valueIn: ValueIn): MoneyValues {
  if (!total) {
    total = {
      costValue: 0,
      dividends: 0,
      marketValue: 0,
      realisedGain: 0,
      totalGain: 0,
      unrealisedGain: 0,
      fees: 0,
      cash: 0,
      purchases: 0,
      sales: 0,
      tax: 0,
      weight: 0,
      costBasis: 0,
      gainOnDay: 0,
      priceData: { close: 0, change: 0, changePercent: 0, priceDate: "", previousClose: 0 },
      valueIn: valueIn,
      averageCost: 0,
      currency: position.moneyValues[valueIn].currency,
    };
  }
  total.marketValue += position.moneyValues[valueIn].marketValue;
  total.costValue += position.moneyValues[valueIn].costValue;
  total.dividends += position.moneyValues[valueIn].dividends;
  total.realisedGain += position.moneyValues[valueIn].realisedGain;
  total.unrealisedGain += position.moneyValues[valueIn].unrealisedGain;
  total.totalGain += position.moneyValues[valueIn].totalGain;
  if (isCash(position.asset)) {
    total.cash += position.moneyValues[valueIn].marketValue;
  } else {
    total.purchases += position.moneyValues[valueIn].purchases;
    total.sales += position.moneyValues[valueIn].sales;
    total.gainOnDay += position.moneyValues[valueIn].gainOnDay;
  }
  return total;
}

function subTotal(totals: MoneyValues[], position: Position, valueIn: ValueIn): MoneyValues[] {
  if (!totals) {
    totals = [];
  }
  totals[valueIn] = total(totals[valueIn], position, valueIn);
  return totals;
}

// Transform the holdingContract into Holdings suitable for display
export function calculate(
  contract: HoldingContract,
  hideEmpty: boolean,
  valueIn: ValueIn,
  groupBy: GroupBy
): Holdings {
  return Object.keys(contract.positions)
    .filter((positionKey) =>
      hideEmpty ? contract.positions[positionKey].quantityValues.total !== 0 : true
    )
    .reduce(
      (results: Holdings, group) => {
        const position = contract.positions[group] as Position;
        const groupKey = getPath(groupBy, position);

        results.holdingGroups[groupKey] = results.holdingGroups[groupKey] || {
          group: groupKey,
          positions: [],
          totals: [],
        };
        results.holdingGroups[groupKey].positions.push(position);
        results.totals[ValueIn.PORTFOLIO] = total(
          results.totals[ValueIn.PORTFOLIO],
          position,
          ValueIn.PORTFOLIO
        );

        // Totalling mixed trade currencies makes no sense, so don't do it
        if (!contract.mixedCurrencies) {
          results.totals[ValueIn.TRADE] = total(
            results.totals[ValueIn.TRADE],
            position,
            ValueIn.TRADE
          );
        }

        results.totals[ValueIn.BASE] = total(results.totals[ValueIn.BASE], position, ValueIn.BASE);
        results.holdingGroups[groupKey].subTotals = subTotal(
          results.holdingGroups[groupKey].subTotals,
          position,
          valueIn
        );

        results.valueIn = valueIn;
        return results;
      },
      {
        portfolio: contract.portfolio,
        holdingGroups: [],
        valueIn: valueIn,
        totals: [],
      }
    );
}
