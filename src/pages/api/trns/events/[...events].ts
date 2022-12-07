import { withApiAuthRequired, getAccessToken } from "@auth0/nextjs-auth0";
import { requestInit } from "@/core/api/fetchHelper";
import handleResponse, { fetchError } from "@/core/api/response-writer";
import { Transaction } from "@/types/beancounter";
import { getDataUrl } from "@/core/api/bc-config";
const baseUrl = getDataUrl("/trns");
export default withApiAuthRequired(async function eventTrns(req, res) {
  try {
    const { events } = req.query;
    const { accessToken } = await getAccessToken(req, res);
    if (events) {
      console.log(`Looking up events for ${events[0]} / ${events[1]}`);
      const response = await fetch(
        `${baseUrl}/${events[0]}/asset/${events[1]}/events`,
        requestInit(accessToken)
      );
      await handleResponse<Transaction[]>(response, res);
    }
  } catch (error: any) {
    fetchError(res, req, error);
  }
});
