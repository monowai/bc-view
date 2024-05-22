import {
  HoldingContract,
  HoldingGroup,
  Holdings,
} from "@components/types/beancounter";
import * as path from "node:path";
import * as fs from "node:fs";
import { GroupBy, ValueIn } from "@components/holdings/GroupByOptions";
import { calculateHoldings } from "@utils/holdings/calculateHoldings";
import { expect, describe } from "@jest/globals";

const dataPath = path.resolve(__dirname, "../__contracts__/test-holdings.json");
const data = fs.readFileSync(dataPath, "utf-8");

function validateTotals(result: Holdings): void {
  const totalGain = 1033.85;
  expect(result.totals.gain).toEqual(totalGain);
}

function validateEtfGains(etfs: HoldingGroup): void {
  const expectedGain = 107.69;
  expect(etfs.subTotals[ValueIn.PORTFOLIO].unrealisedGain).toEqual(
    expectedGain,
  );
  expect(etfs.subTotals[ValueIn.BASE].unrealisedGain).toEqual(expectedGain);
  expect(etfs.subTotals[ValueIn.TRADE].unrealisedGain).toEqual(expectedGain);
}

describe("calculate function", () => {
  const mockContract: HoldingContract = JSON.parse(data).data;
  const valueIn = ValueIn.PORTFOLIO;
  const groupBy = GroupBy.ASSET_CLASS;

  it("including all exited positions should compute sub totals", () => {
    const hideEmpty = false;

    const holdings = calculateHoldings(
      mockContract,
      hideEmpty,
      valueIn,
      groupBy,
    );
    expect(holdings.portfolio).toEqual(mockContract.portfolio);
    expect(holdings.holdingGroups["Cash"].positions.length).toEqual(1);
    const equities = holdings.holdingGroups["Equity"];
    expect(equities.positions.length).toEqual(2);
    expect(equities.subTotals[ValueIn.PORTFOLIO].costValue).toEqual(3701.0);
    expect(equities.subTotals[ValueIn.TRADE].costValue).toEqual(3701.0);
    expect(equities.subTotals[ValueIn.BASE].costValue).toEqual(3701.0);
    const etfs = holdings.holdingGroups["Exchange Traded Fund"];
    expect(etfs.positions.length).toEqual(2);
    validateEtfGains(etfs);
    validateTotals(holdings);
  });

  it("should compute totals when showing exited positions", () => {
    const hideEmpty = true;

    const result = calculateHoldings(mockContract, hideEmpty, valueIn, groupBy);
    expect(result.holdingGroups["Cash"].positions.length).toEqual(1);
    const equities = result.holdingGroups["Equity"];
    expect(equities.positions.length).toEqual(2);
    const etfs = result.holdingGroups["Exchange Traded Fund"];
    expect(etfs.positions.length).toEqual(1);
    validateEtfGains(etfs);
    validateTotals(result);
  });

  it("calculate all sub-totals when hiding exited positions", () => {
    const hideEmpty = false;

    const result = calculateHoldings(mockContract, hideEmpty, valueIn, groupBy);
    expect(result.viewTotals.marketValue).toEqual(11033.85);
    expect(result.viewTotals.gainOnDay).toEqual(118.83);

    expect(result.viewTotals.realisedGain).toEqual(-224.67);
  });
  it("calculate all sub-totals when showing exited positions", () => {
    const hideEmpty = true;

    const result = calculateHoldings(mockContract, hideEmpty, valueIn, groupBy);
    expect(result.viewTotals.marketValue).toEqual(11033.85);
    expect(result.viewTotals.gainOnDay).toEqual(118.83);
    expect(result.viewTotals.realisedGain).toEqual(134.33);
  });
});
