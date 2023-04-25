import { withApiAuthRequired, getAccessToken } from "@auth0/nextjs-auth0";
import { headerRequest } from "@/core/api/fetchHelper";
import handleResponse, { fetchError } from "@/core/api/response-writer";
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
        headerRequest(accessToken)
      );
      await handleResponse<Transaction[]>(response, res);
    }
  } catch (error: any) {
    fetchError(res, req, error);
  }
});
