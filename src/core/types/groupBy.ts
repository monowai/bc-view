import { GroupOption } from "./beancounter";

// Enum is a path to a property in the holding contract
export enum GroupBy {
  MARKET_CURRENCY = "asset.market.currency.code",
  MARKET = "asset.market.code",
  ASSET_CLASS = "asset.assetCategory.name",
}

export function groupOptions(): GroupOption[] {
  // const { t, ready } = useTranslation("common");
  return [
    {
      value: GroupBy.ASSET_CLASS,
      label: "Asset Class",
    },
    {
      value: GroupBy.MARKET_CURRENCY,
      label: "Currency",
    },
    { value: GroupBy.MARKET, label: "Market" },
  ];
}

export const defaultGroup = 0;
