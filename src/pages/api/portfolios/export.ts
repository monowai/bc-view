import { createCsvExportHandler } from "@utils/api/csvHandlers"
import { getDataUrl } from "@utils/api/bcConfig"

export default createCsvExportHandler(
  getDataUrl("/portfolios/export"),
  "portfolios.csv",
)
