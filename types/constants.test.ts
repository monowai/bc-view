import {
  apiValueToPropertyPath,
  propertyPathToApiValue,
  GROUP_BY_API_VALUES,
  GROUP_BY_PROPERTY_PATHS,
  GroupByApiValue,
  GroupByPropertyPath,
} from "./constants"

describe("GroupBy mapping functions", () => {
  describe("apiValueToPropertyPath", () => {
    it("maps ASSET_CLASS to asset.assetCategory.name", () => {
      expect(apiValueToPropertyPath("ASSET_CLASS")).toBe(
        "asset.assetCategory.name",
      )
    })

    it("maps SECTOR to asset.sector", () => {
      expect(apiValueToPropertyPath("SECTOR")).toBe("asset.sector")
    })

    it("maps MARKET_CURRENCY to asset.market.currency.code", () => {
      expect(apiValueToPropertyPath("MARKET_CURRENCY")).toBe(
        "asset.market.currency.code",
      )
    })

    it("maps MARKET to asset.market.code", () => {
      expect(apiValueToPropertyPath("MARKET")).toBe("asset.market.code")
    })

    it("maps all API values correctly", () => {
      const apiValues = Object.keys(GROUP_BY_API_VALUES) as Array<
        keyof typeof GROUP_BY_API_VALUES
      >
      apiValues.forEach((key) => {
        const apiValue = GROUP_BY_API_VALUES[key]
        const propertyPath = GROUP_BY_PROPERTY_PATHS[key]
        expect(apiValueToPropertyPath(apiValue)).toBe(propertyPath)
      })
    })
  })

  describe("propertyPathToApiValue", () => {
    it("maps asset.assetCategory.name to ASSET_CLASS", () => {
      expect(propertyPathToApiValue("asset.assetCategory.name")).toBe(
        "ASSET_CLASS",
      )
    })

    it("maps asset.sector to SECTOR", () => {
      expect(propertyPathToApiValue("asset.sector")).toBe("SECTOR")
    })

    it("maps asset.market.currency.code to MARKET_CURRENCY", () => {
      expect(propertyPathToApiValue("asset.market.currency.code")).toBe(
        "MARKET_CURRENCY",
      )
    })

    it("maps asset.market.code to MARKET", () => {
      expect(propertyPathToApiValue("asset.market.code")).toBe("MARKET")
    })

    it("maps all property paths correctly", () => {
      const keys = Object.keys(GROUP_BY_PROPERTY_PATHS) as Array<
        keyof typeof GROUP_BY_PROPERTY_PATHS
      >
      keys.forEach((key) => {
        const propertyPath = GROUP_BY_PROPERTY_PATHS[key]
        const apiValue = GROUP_BY_API_VALUES[key]
        expect(propertyPathToApiValue(propertyPath)).toBe(apiValue)
      })
    })
  })

  describe("round-trip conversion", () => {
    it("converts API value to property path and back", () => {
      const apiValues = Object.values(GROUP_BY_API_VALUES) as GroupByApiValue[]
      apiValues.forEach((apiValue) => {
        const propertyPath = apiValueToPropertyPath(apiValue)
        const backToApi = propertyPathToApiValue(propertyPath)
        expect(backToApi).toBe(apiValue)
      })
    })

    it("converts property path to API value and back", () => {
      const propertyPaths = Object.values(
        GROUP_BY_PROPERTY_PATHS,
      ) as GroupByPropertyPath[]
      propertyPaths.forEach((propertyPath) => {
        const apiValue = propertyPathToApiValue(propertyPath)
        const backToPath = apiValueToPropertyPath(apiValue)
        expect(backToPath).toBe(propertyPath)
      })
    })
  })
})
