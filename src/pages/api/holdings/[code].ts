// noinspection JSUnusedGlobalSymbols

import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0";
import { headerRequest } from "@/core/api/fetchHelper";
import handleResponse, { fetchError } from "@/core/api/response-writer";
import { HoldingContract } from "@/types/beancounter";
import { getPositionsUrl } from "@/core/api/bc-config";

const baseUrl = getPositionsUrl("");
export default withApiAuthRequired(async function holdingsByCode(req, res) {
  try {
    const { accessToken } = await getAccessToken(req, res);
    const {
      query: { code },
    } = req;
    console.log(`Looking up holdings ${code}`);
    const response = await fetch(`${baseUrl}/${code}/today`, headerRequest(accessToken));
    await handleResponse<HoldingContract>(response, res);
  } catch (error: any) {
    fetchError(res, req, error);
  }
});
