import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { Portfolio, PortfolioResponse } from "types/beancounter"
import { getDataUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

const baseUrl = getDataUrl("/portfolios")

export default withApiAuthRequired(async function portfoliosById(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const {
      method,
      query: { id },
    } = req
    const { accessToken } = await getAccessToken(req, res)
    console.log(`${method} for portfolio ${id}`)
    const byId = `${baseUrl}/${id}`
    switch (method?.toUpperCase()) {
      case "GET": {
        if (id === "__NEW__") {
          const defaultPortfolio = {
            data: {
              id: "",
              code: "",
              name: "",
              currency: { id: "USD", code: "USD", symbol: "$" },
              base: { id: "USD", code: "USD", symbol: "$" },
            },
          }
          res.status(200).json(defaultPortfolio)
          break
        } else {
          const response = await fetch(byId, requestInit(accessToken, "GET", req))
          await handleResponse<Portfolio>(response, res)
          break
        }
      }
      case "PATCH": {
        const response = await fetch(byId, {
          ...requestInit(accessToken, method, req),
          body: JSON.stringify(req.body),
        })
        await handleResponse<Portfolio>(response, res)
        break
      }

      case "POST": {
        const response = await fetch(`${baseUrl}`, {
          ...requestInit(accessToken, method, req),
          body: JSON.stringify(req.body),
        })
        await handleResponse<PortfolioResponse>(response, res)
        break
      }

      case "DELETE": {
        const response = await fetch(byId, requestInit(accessToken, method, req))
        await handleResponse<void>(response, res)
        break
      }
    }
  } catch (error: any) {
    fetchError(res, req, error)
  }
})
