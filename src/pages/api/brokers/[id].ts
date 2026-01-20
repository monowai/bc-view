import { getAccessToken, withApiAuthRequired } from "@auth0/nextjs-auth0"
import { requestInit } from "@utils/api/fetchHelper"
import handleResponse, { fetchError } from "@utils/api/responseWriter"
import { Broker, BrokerResponse } from "types/beancounter"
import { getDataUrl } from "@utils/api/bcConfig"
import { NextApiRequest, NextApiResponse } from "next"

const baseUrl = getDataUrl("/brokers")

export default withApiAuthRequired(async function brokersById(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  try {
    const {
      method,
      query: { id },
    } = req
    const { accessToken } = await getAccessToken(req, res)
    console.log(`${method} for broker ${id}`)
    const byId = `${baseUrl}/${id}`
    switch (method?.toUpperCase()) {
      case "GET": {
        if (id === "__NEW__") {
          const defaultBroker: BrokerResponse = {
            data: {
              id: "",
              name: "",
              accountNumber: "",
              notes: "",
            },
          }
          res.status(200).json(defaultBroker)
          break
        } else {
          const response = await fetch(
            byId,
            requestInit(accessToken, "GET", req),
          )
          await handleResponse<Broker>(response, res)
          break
        }
      }
      case "PATCH": {
        const response = await fetch(byId, {
          ...requestInit(accessToken, method, req),
          body: JSON.stringify(req.body),
        })
        await handleResponse<Broker>(response, res)
        break
      }
      case "DELETE": {
        const response = await fetch(
          byId,
          requestInit(accessToken, method, req),
        )
        await handleResponse<void>(response, res)
        break
      }
      default:
        res.setHeader("Allow", ["GET", "PATCH", "DELETE"])
        res.status(405).end(`Method ${method} Not Allowed`)
    }
  } catch (error: any) {
    fetchError(req, res, error)
  }
})
