import express from "express";
import { makeRequest } from "../core/common/axiosUtils";
import { bcConfig } from "../core/common/config";
import { AxiosRequestConfig } from "axios";
import { positionUrl } from "../server/utils";

export const getPositions = async (req: express.Request, res: express.Response): Promise<any> => {
  const opts = {
    url: positionUrl(req, bcConfig.bcPositions).toString(),
    headers: req.headers,
    method: "GET",
  } as AxiosRequestConfig;
  await makeRequest(req, opts, res);
};
