// noinspection JSUnusedGlobalSymbols

import { withApiAuthRequired, getAccessToken } from "@auth0/nextjs-auth0";
import { requestInit } from "@/core/api/use-api-fetch-helper";
import handleResponse from "@/core/api/response-writer";
import { HoldingContract } from "@/types/beancounter";
import { getPositionsUrl } from "@/core/api/bc-config";
const baseUrl = getPositionsUrl("");
export default withApiAuthRequired(async function holdingsByCode(req, res) {
  try {
    const {
      query: { code },
    } = req;
    const { accessToken } = await getAccessToken(req, res);
    console.log(`Looking up holdings ${code}`);
    const response = await fetch(`${baseUrl}/${code}/today`, requestInit(accessToken));
    await handleResponse<HoldingContract>(response, res);
  } catch (error: any) {
    console.error(error);
    res.status(error.status || 500).json({
      code: error.code,
      error: error.message,
    });
  }
});
