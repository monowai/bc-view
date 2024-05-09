import {HoldingContract} from "@components/types/beancounter";
import * as path from "node:path";
import * as fs from "node:fs";
import {GroupBy, ValueIn} from "@components/holdings/GroupByOptions";
import {calculateHoldings} from "@utils/holdings/calculateHoldings";

const dataPath = path.resolve(__dirname, "../__contracts__/test-holdings.json");
const data = fs.readFileSync(dataPath, "utf-8");

describe("calculate function", () => {
    it("should compute totals when hiding exited positions", () => {
        const mockContract: HoldingContract = JSON.parse(data).data;
        const hideEmpty = false;
        const valueIn = ValueIn.PORTFOLIO;
        const groupBy = GroupBy.ASSET_CLASS;

        const result = calculateHoldings(mockContract, hideEmpty, valueIn, groupBy);
        expect(result.portfolio).toEqual(mockContract.portfolio);
        expect(result.holdingGroups["Cash"].positions.length).toEqual(1);
        const etfs = result.holdingGroups["Exchange Traded Fund"]
        expect(etfs.positions.length).toEqual(2);
        expect(etfs.subTotals[ValueIn.PORTFOLIO].unrealisedGain).toEqual(106.73);
        expect(result.totals[ValueIn.TRADE].purchases).toEqual(2000);
        expect(result.totals[ValueIn.TRADE].unrealisedGain).toEqual(106.73);
        expect(result.totals[ValueIn.TRADE].purchases).toEqual(2000);
        expect(result.totals[ValueIn.PORTFOLIO].purchases).toEqual(2000);
        expect(result.totals[ValueIn.BASE].purchases).toEqual(2000);
    });

    it("should compute totals when showing exited positions", () => {
        const mockContract: HoldingContract = JSON.parse(data).data;
        const hideEmpty = true;
        const valueIn = ValueIn.PORTFOLIO;
        const groupBy = GroupBy.ASSET_CLASS;

        const result = calculateHoldings(mockContract, hideEmpty, valueIn, groupBy);
        expect(result.holdingGroups["Cash"].positions.length).toEqual(1);
        expect(
            result.holdingGroups["Exchange Traded Fund"].positions.length
        ).toEqual(1);
        // Totals should be the same as when hiding exited positions
        expect(result.totals[ValueIn.TRADE].purchases).toEqual(2000);
        expect(result.totals[ValueIn.PORTFOLIO].purchases).toEqual(2000);
        expect(result.totals[ValueIn.BASE].purchases).toEqual(2000);
    });
});
