// noinspection JSUnusedGlobalSymbols

import { withApiAuthRequired, getAccessToken } from "@auth0/nextjs-auth0";
import { requestInit } from "@/core/api/use-api-fetch-helper";
import handleResponse from "@/core/api/response-writer";
import { Portfolio } from "@/types/beancounter";
import { getDataUrl } from "@/core/api/bc-config";
const baseUrl = getDataUrl("/portfolios");
export default withApiAuthRequired(async function portfoliosById(req, res) {
  try {
    const {
      query: { id },
    } = req;
    const { accessToken } = await getAccessToken(req, res);
    console.log(`Looking up portfolio ${id}`);
    const response = await fetch(`${baseUrl}/${id}`, requestInit(accessToken));
    await handleResponse<Portfolio>(response, res);
  } catch (error: any) {
    console.error(error);
    res.status(error.status || 500).json({
      code: error.code,
      error: error.message,
    });
  }
});
