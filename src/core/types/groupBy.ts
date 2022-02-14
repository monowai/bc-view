import { GroupOption } from "./beancounter";
import { translate } from "../common/i18nUtils";

// Enum is a path to a property in the holding contract
export enum GroupBy {
  MARKET_CURRENCY = "asset.market.currency.code",
  MARKET = "asset.market.code",
  ASSET_CLASS = "asset.assetCategory.name",
}

export function groupOptions(): GroupOption[] {
  return [
    {
      value: GroupBy.ASSET_CLASS,
      label: translate("groupby.class"),
    },
    {
      value: GroupBy.MARKET_CURRENCY,
      label: translate("groupby.currency"),
    },
    { value: GroupBy.MARKET, label: translate("groupby.market") },
  ];
}

export const defaultGroup = 0;
