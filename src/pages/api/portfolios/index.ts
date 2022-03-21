// noinspection JSUnusedGlobalSymbols

import { withApiAuthRequired, getAccessToken } from "@auth0/nextjs-auth0";
import getConfig from "next/config";
import { requestInit } from "@/core/api/use-api-fetch-helper";
import handleResponse from "@/core/api/response-writer";
import { Portfolio } from "@/types/beancounter";

const { publicRuntimeConfig } = getConfig();
const baseUrl = `${publicRuntimeConfig.apiDataUrl}/portfolios`;

export default withApiAuthRequired(async function portfolios(req, res) {
  console.log(`requesting portfolios from ${baseUrl}`);
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
