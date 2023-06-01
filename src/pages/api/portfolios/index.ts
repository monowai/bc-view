// noinspection JSUnusedGlobalSymbols

import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0";
import { headerRequest } from "@core/api/fetchHelper";
import handleResponse, { fetchError } from "@core/api/response-writer";
import { Portfolio } from "@core/types/beancounter";
import { getDataUrl } from "@core/api/bc-config";

const baseUrl = getDataUrl("/portfolios");

export default withApiAuthRequired(async function portfolios(req, res) {
  // console.log(`API portfolios from ${baseUrl}`);
  try {
    const { accessToken } = await getAccessToken(req, res);
    const response = await fetch(`${baseUrl}`, headerRequest(accessToken));
    await handleResponse<Portfolio[]>(response, res);
  } catch (error: any) {
    fetchError(res, req, error);
  }
});
