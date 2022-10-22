import { withApiAuthRequired, getAccessToken } from "@auth0/nextjs-auth0";
import { requestInit } from "@/core/api/use-api-fetch-helper";
import handleResponse from "@/core/api/response-writer";
import { Transaction } from "@/types/beancounter";
import { getDataUrl } from "@/core/api/bc-config";
const baseUrl = getDataUrl("/trns");
export default withApiAuthRequired(async function tradeTrns(req, res) {
  try {
    const { trades } = req.query;
    const { accessToken } = await getAccessToken(req, res);
    if (trades) {
      console.log(`Looking up trades for ${trades[0]} / ${trades[1]}`);
      const response = await fetch(
        `${baseUrl}/${trades[0]}/asset/${trades[1]}/trades`,
        requestInit(accessToken)
      );
      await handleResponse<Transaction[]>(response, res);
    }
  } catch (error: any) {
    console.error(error);
    res.status(error.status || 500).json({
      code: error.code,
      error: error.message,
    });
  }
});
