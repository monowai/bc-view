import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0";
import handleResponse, { fetchError } from "@core/api/response-writer";
import { Transaction } from "@core/types/beancounter";
import { getDataUrl } from "@core/api/bc-config";

const baseUrl = getDataUrl("/trns");
export default withApiAuthRequired(async function tradeTrns(req, res) {
  try {
    const { trades } = req.query;
    const { method } = req;
    const { accessToken } = await getAccessToken(req, res);
    if (trades) {
      console.log(`${method} trades for ${trades[0]} / ${trades[1]}`);
      switch (method) {
        case "GET": {
          const response = await fetch(
            `${baseUrl}/${trades[0]}/asset/${trades[1]}/trades`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );
          await handleResponse<Transaction[]>(response, res);
          break;
        }
        case "DELETE": {
          console.log(`Delete trnId: ${trades[0]}`);
          const response = await fetch(`${baseUrl}/${trades[0]}`, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });
          await handleResponse(response, res);
          break;
        }
      }
    }
  } catch (error: any) {
    fetchError(res, req, error);
  }
});
