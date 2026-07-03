import { createCsvImportHandler } from "@utils/api/csvHandlers"
import { getDataUrl } from "@utils/api/bcConfig"
import { PortfolioResponses } from "types/beancounter"

export default createCsvImportHandler<PortfolioResponses>(
  getDataUrl("/portfolios/import"),
  "portfolios.csv",
)
