import { createCsvImportHandler } from "@utils/api/csvHandlers"
import { getDataUrl } from "@utils/api/bcConfig"
import { AssetResponse } from "types/beancounter"

export default createCsvImportHandler<AssetResponse>(
  getDataUrl("/assets/me/import"),
  "assets.csv",
)
