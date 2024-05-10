import {
  Currency,
  HoldingContract,
  HoldingGroup,
  Holdings,
  MoneyValues,
  Position,
} from "@components/types/beancounter";
import { isCashRelated } from "@utils/assets/assetUtils";
import { GroupBy, ValueIn } from "@components/holdings/GroupByOptions";

function getPath(path: string, position: Position): string {
  return path
    .split(".")
    .reduce(
      (p: any, path: string) => (p && p[path]) || "undefined",
      position
    ) as unknown as string;
}

// Helper function to update total
function updateSubTotal(
  subTotal: MoneyValues,
  position: Position,
  valueIn: ValueIn
): MoneyValues {
  const keys: (keyof MoneyValues)[] = [
    "marketValue",
    "costValue",
    "dividends",
    "realisedGain",
    "unrealisedGain",
    "totalGain",
  ];
  keys.forEach((key) => {
    if (typeof position.moneyValues[valueIn][key] === "number") {
      subTotal[key] += position.moneyValues[valueIn][key];
    }
  });
  if (isCashRelated(position.asset)) {
    subTotal.cash += position.moneyValues[valueIn].marketValue;
  } else {
    subTotal.purchases += position.moneyValues[valueIn].purchases;
    subTotal.sales += position.moneyValues[valueIn].sales;
    if (position.moneyValues[valueIn].priceData) {
      if (position.moneyValues[valueIn].priceData.changePercent) {
        subTotal.gainOnDay += position.moneyValues[valueIn].gainOnDay;
      }
    }
  }
  return subTotal;
}

function zeroTotal(currency: Currency, valueIn: ValueIn) {
    return {
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
        roi: 0,
        costBasis: 0,
        gainOnDay: 0,
        priceData: {
            close: 0,
            change: 0,
            changePercent: 0,
            priceDate: "",
            previousClose: 0,
        },
        valueIn: valueIn,
        averageCost: 0,
        currency: currency,
    };
}

function createHoldingGroup(
  _groupKey: string,
  position: Position
): HoldingGroup {
  const initialTotals: Record<ValueIn, MoneyValues> = {
    [ValueIn.PORTFOLIO]: zeroTotal(
      position.moneyValues[ValueIn.PORTFOLIO].currency,
      ValueIn.PORTFOLIO
    ),
    [ValueIn.BASE]: zeroTotal(
      position.moneyValues[ValueIn.BASE].currency,
      ValueIn.BASE
    ),
    [ValueIn.TRADE]: zeroTotal(
      position.moneyValues[ValueIn.TRADE].currency,
      ValueIn.TRADE
    ),
  };

  return {
    positions: [],
    subTotals: initialTotals,
  };
}

function addSubtotalPosition(
  subTotals: Record<ValueIn, MoneyValues>,
  position: Position,
  valueIn: ValueIn
): Record<ValueIn, MoneyValues> {
  subTotals[ValueIn.BASE] = updateSubTotal(
    subTotals[ValueIn.BASE],
    position,
    valueIn
  );
  subTotals[ValueIn.PORTFOLIO] = updateSubTotal(
    subTotals[ValueIn.PORTFOLIO],
    position,
    valueIn
  );
  subTotals[ValueIn.TRADE] = updateSubTotal(
    subTotals[ValueIn.TRADE],
    position,
    valueIn
  );
  return subTotals;
}

export function calculateHoldings(
  contract: HoldingContract,
  hideEmpty: boolean,
  valueIn: ValueIn,
  groupBy: GroupBy
): Holdings {
  const filteredPositions = Object.keys(contract.positions).filter(
    (key) => !(hideEmpty && contract.positions[key].quantityValues.total === 0)
  );

  return filteredPositions.reduce(
    (results: Holdings, group) => {
      const position = contract.positions[group] as Position;
      const groupKey = getPath(groupBy, position);
      results.holdingGroups[groupKey] =
        results.holdingGroups[groupKey] ||
        createHoldingGroup(groupKey, position);

      results.holdingGroups[groupKey].positions.push(position);
      results.holdingGroups[groupKey].subTotals = addSubtotalPosition(
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
