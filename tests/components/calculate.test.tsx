import { HoldingContract } from "@components/types/beancounter";
import * as path from "node:path";
import * as fs from "node:fs";
import { GroupBy, ValueIn } from "@components/holdings/GroupByOptions";
import { calculateHoldings } from "@utils/holdings/calculateHoldings";

const dataPath = path.resolve(__dirname, "../__contracts__/test-holdings.json");
const data = fs.readFileSync(dataPath, "utf-8");

describe("calculate function", () => {
  const expectedGain = 107.69;

  it("including all exited positions should compute sub totals", () => {
    const mockContract: HoldingContract = JSON.parse(data).data;
    const hideEmpty = false;
    const valueIn = ValueIn.PORTFOLIO;
    const groupBy = GroupBy.ASSET_CLASS;

    const result = calculateHoldings(mockContract, hideEmpty, valueIn, groupBy);
    expect(result.portfolio).toEqual(mockContract.portfolio);
    expect(result.holdingGroups["Cash"].positions.length).toEqual(1);
    const equities = result.holdingGroups["Equity"];
    expect(equities.positions.length).toEqual(2);
    expect(equities.subTotals[ValueIn.PORTFOLIO].costValue).toEqual(3701.0);
    expect(equities.subTotals[ValueIn.TRADE].costValue).toEqual(3701.0);
    expect(equities.subTotals[ValueIn.BASE].costValue).toEqual(3701.0);
    const etfs = result.holdingGroups["Exchange Traded Fund"];
    expect(etfs.positions.length).toEqual(2);
    expect(etfs.subTotals[ValueIn.PORTFOLIO].unrealisedGain).toEqual(
      expectedGain
    );
    expect(etfs.subTotals[ValueIn.BASE].unrealisedGain).toEqual(expectedGain);
    expect(etfs.subTotals[ValueIn.TRADE].unrealisedGain).toEqual(expectedGain);
  });

  it("should compute totals when showing exited positions", () => {
    const mockContract: HoldingContract = JSON.parse(data).data;
    const hideEmpty = true;
    const valueIn = ValueIn.PORTFOLIO;
    const groupBy = GroupBy.ASSET_CLASS;

    const result = calculateHoldings(mockContract, hideEmpty, valueIn, groupBy);
    expect(result.holdingGroups["Cash"].positions.length).toEqual(1);
    const equities = result.holdingGroups["Equity"];
    expect(equities.positions.length).toEqual(2);
    const etfs = result.holdingGroups["Exchange Traded Fund"];
    expect(etfs.positions.length).toEqual(1);
    expect(etfs.subTotals[ValueIn.PORTFOLIO].unrealisedGain).toEqual(
      expectedGain
    );
    expect(etfs.subTotals[ValueIn.BASE].unrealisedGain).toEqual(expectedGain);
    expect(etfs.subTotals[ValueIn.TRADE].unrealisedGain).toEqual(expectedGain);

    // Totals should be the same as when hiding exited positions
    // expect(result.totals[ValueIn.TRADE].purchases).toEqual(2000);
    // expect(result.totals[ValueIn.PORTFOLIO].purchases).toEqual(2000);
    // expect(result.totals[ValueIn.BASE].purchases).toEqual(2000);
  });
});
