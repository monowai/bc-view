import React from "react"
import * as Sentry from "@sentry/nextjs"
import Error from "next/error"
import { NextPageContext } from "next"

interface CustomErrorComponentProps {
  statusCode: number
}

const CustomErrorComponent = ({
  statusCode,
}: CustomErrorComponentProps): JSX.Element => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-6 rounded-lg shadow-lg text-center">
        <Error statusCode={statusCode} />
        <p className="mt-4 text-gray-600">
          {statusCode
            ? `An error ${statusCode} occurred on server`
            : "An error occurred on client"}
        </p>
      </div>
    </div>
  )
}

CustomErrorComponent.getInitialProps = async (
  contextData: NextPageContext,
): Promise<{ statusCode: number }> => {
  // In case this is running in a serverless function, await this in order to give Sentry
  // time to send the error before the lambda exits
  await Sentry.captureUnderscoreErrorException(contextData)

  // This will contain the status code of the response
  return Error.getInitialProps(contextData)
}

export default CustomErrorComponent
