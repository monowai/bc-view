import React, { useState } from "react";
import { SubTotal } from "./SubTotal";
import { calculate } from "./calculate";
import { defaultGroup, groupOptions } from "../../core/types/groupBy";
import { GroupOption, Holdings, ValuationOption } from "../../core/types/beancounter";
import Total from "./Total";
import SummaryHeader, { SummaryRow } from "./Summary";
import Switch from "react-switch";
import Select, { OnChangeValue } from "react-select";
import { valuationOptions, ValueIn } from "../../core/types/constants";
import { useHoldings } from "./hooks";
import { Rows } from "./Rows";
import { Header } from "./Header";
import { isDone } from "../../core/types/typeUtils";
import PageLoader from "../../core/common/PageLoader";
import { TrnDropZone } from "../portfolio/DropZone";
import { ShowError } from "../../core/errors/ShowError";

export default function ViewHoldings(code: string): JSX.Element {
  const holdingResults = useHoldings(code);
  const [valueIn, setValueIn] = useState<ValuationOption>({
    value: ValueIn.PORTFOLIO,
    label: "Portfolio",
  });
  const [hideEmpty, setHideEmpty] = useState<boolean>(true);
  const [groupBy, setGroupBy] = useState<GroupOption>(groupOptions()[defaultGroup]);

  // Render where we are in the initialization process
  if (isDone(holdingResults)) {
    if (holdingResults.error) {
      return <ShowError {...holdingResults.error} />;
    }
    if (!holdingResults.data.positions) {
      return (
        <div data-testid="dropzone">
          <label>This portfolio has no transactions. Please drop your CSV file to upload</label>
          <TrnDropZone portfolio={holdingResults.data.portfolio} purge={false} />
        </div>
      );
    }
    const holdings = calculate(
      holdingResults.data,
      hideEmpty,
      valueIn.value,
      groupBy.value
    ) as Holdings;
    return (
      <div className="page-box">
        <div className="filter-columns">
          <div className="filter-label">Value In</div>
          <div className="filter-column">
            <Select
              options={valuationOptions()}
              defaultValue={valueIn}
              isSearchable={false}
              isClearable={false}
              onChange={(newValue: OnChangeValue<ValuationOption, false>) => {
                if (newValue) {
                  setValueIn(newValue as ValuationOption);
                }
              }}
            />
          </div>
          <div className="filter-label">Group By</div>
          <div className="filter-column">
            <Select
              options={groupOptions()}
              defaultValue={groupBy}
              isSearchable={false}
              isClearable={false}
              onChange={(newValue: OnChangeValue<GroupOption, false>) => {
                if (newValue) {
                  setGroupBy(newValue as GroupOption);
                }
              }}
            />
          </div>
          <div className="filter-label">Open Only</div>
          <div className="filter-column">
            <Switch
              className="react-switch"
              onColor="#000"
              onChange={setHideEmpty}
              checked={hideEmpty}
              required
            />
          </div>
        </div>
        <div className={"stats-container"}>
          <table>
            <SummaryHeader {...holdingResults.data.portfolio} />
            <SummaryRow
              portfolio={holdingResults.data.portfolio}
              moneyValues={holdings.totals}
              valueIn={valueIn.value}
            />
          </table>
        </div>
        <div className={"all-getData"}>
          <table className={"table is-striped is-hoverable"}>
            {Object.keys(holdings.holdingGroups)
              .sort()
              .map((groupKey) => {
                return (
                  <React.Fragment key={groupKey}>
                    <Header groupKey={groupKey} />
                    <Rows
                      portfolio={holdingResults.data.portfolio}
                      groupBy={groupKey}
                      holdingGroup={holdings.holdingGroups[groupKey]}
                      valueIn={valueIn.value}
                    />
                    <SubTotal
                      groupBy={groupKey}
                      subTotals={holdings.holdingGroups[groupKey].subTotals}
                      valueIn={valueIn.value}
                    />
                  </React.Fragment>
                );
              })}
            <Total holdings={holdings} valueIn={valueIn.value} />
          </table>
        </div>
      </div>
    );
  }
  return <PageLoader message={"Crunching data..."} show={true} data-testid={"loading"} />;
}
