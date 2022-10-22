// noinspection JSUnusedGlobalSymbols

import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0";
import { requestInit } from "@/core/api/use-api-fetch-helper";
import handleResponse from "@/core/api/response-writer";
import { Portfolio } from "@/types/beancounter";
import { getDataUrl } from "@/core/api/bc-config";

const baseUrl = getDataUrl("/portfolios");

export default withApiAuthRequired(async function portfolios(req, res) {
  console.log(`API portfolios from ${baseUrl}`);
  try {
    const { accessToken } = await getAccessToken(req, res);
    const response = await fetch(`${baseUrl}`, requestInit(accessToken));
    await handleResponse<Portfolio[]>(response, res);
  } catch (error: any) {
    console.error(error);
    res.status(error.status || 500).json({
      code: error.code,
      error: error.message,
    });
  }
});
