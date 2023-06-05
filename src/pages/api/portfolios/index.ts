import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0";
import { requestInit } from "@core/api/fetchHelper";
import handleResponse, { fetchError } from "@core/api/response-writer";
import { Portfolio } from "@core/types/beancounter";
import { getDataUrl } from "@core/api/bc-config";

const baseUrl = getDataUrl("/portfolios");

export default withApiAuthRequired(async function portfolios(req, res) {
  try {
    const { accessToken } = await getAccessToken(req, res);
    const response = await fetch(`${baseUrl}`, requestInit(accessToken));
    await handleResponse<Portfolio[]>(response, res);
  } catch (error: any) {
    fetchError(res, req, error);
  }
});
