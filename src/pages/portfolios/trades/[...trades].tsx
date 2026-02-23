import React, { useState } from "react"
import { NumericFormat } from "react-number-format"
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client"
import { useRouter } from "next/router"
import { assetKey, simpleFetcher, tradeKey } from "@utils/api/fetchHelper"
import Link from "next/link"
import { Transaction } from "types/beancounter"
import { rootLoader } from "@components/ui/PageLoader"
import { errorOut } from "@components/errors/ErrorOut"
import useSwr from "swr"
import { deleteTrn } from "@lib/trns/apiHelper"
import ConfirmDialog from "@components/ui/ConfirmDialog"

export default withPageAuthRequired(function Events(): React.ReactElement {
  const [deleteTrnId, setDeleteTrnId] = useState<string | null>(null)

  const router = useRouter()
  const portfolioId = router.query.trades ? router.query.trades[0] : "undefined"
  const assetId = router.query.trades ? router.query.trades[1] : "undefined"
  const asset = useSwr(assetKey(assetId), simpleFetcher(assetKey(assetId)))
  const trades = useSwr(
    tradeKey(portfolioId, assetId),
    simpleFetcher(tradeKey(portfolioId, assetId)),
  )
  if (trades.error) {
    return errorOut("Error retrieving trades", trades.error)
  }
  if (asset.error) {
    return errorOut("Error retrieving asset information", asset.error)
  }
  if (asset.isLoading || trades.isLoading) {
    return rootLoader("Loading...")
  }
  const trnResults = trades.data.data
  if (!trnResults || trnResults.length === 0) {
    return <div id="root">{"No transactions found"}</div>
  }
  return (
    <div>
      <nav className="container">
        <div className={"page-title"}>
          <div className={"column page-title subtitle is-6"}>
            {asset.data.data.name}:{asset.data.data.market.code}
          </div>
        </div>
      </nav>
      <div className="page-box is-primary has-background-light">
        <div className="container">
          <table className={"table is-striped is-hoverable"}>
            <thead>
              <tr>
                <th>{"Type"}</th>
                <th>{"Currency"}</th>
                <th>{"Trade Date"}</th>
                <th align={"right"}>{"Qty"}</th>
                <th align={"right"}>{"Price"}</th>
                <th align={"right"}>{"Amount"}</th>
                <th align={"right"}>{"T/B Rate"}</th>
                <th align={"right"}>{"T/C Rate"}</th>
                <th align={"right"}>{"T/P Rate"}</th>
                <th align={"right"}>{"Cash"}</th>
                <th align={"right"}>{"Tax"}</th>
                <th align={"right"}>{"Fees"}</th>
                <th align={"right"}>{"Action"}</th>
              </tr>
            </thead>
            <tbody>
              {trnResults.map((trn: Transaction) => (
                <tr key={trn.id}>
                  <td>{trn.trnType}</td>
                  <td>{trn.tradeCurrency.code}</td>
                  <td>{trn.tradeDate}</td>
                  <td align={"right"}>
                    <NumericFormat
                      value={trn.quantity}
                      displayType={"text"}
                      decimalScale={2}
                      fixedDecimalScale={true}
                      thousandSeparator={true}
                    />
                  </td>
                  <td align={"right"}>
                    <NumericFormat
                      value={trn.price}
                      displayType={"text"}
                      decimalScale={2}
                      fixedDecimalScale={true}
                      thousandSeparator={true}
                    />
                  </td>
                  <td align={"right"}>
                    <NumericFormat
                      value={trn.tradeAmount}
                      displayType={"text"}
                      decimalScale={0}
                      fixedDecimalScale={true}
                      thousandSeparator={true}
                    />
                  </td>
                  <td align={"right"}>
                    <NumericFormat
                      value={trn.tradeBaseRate}
                      displayType={"text"}
                      decimalScale={4}
                      fixedDecimalScale={true}
                      thousandSeparator={true}
                    />
                  </td>
                  <td align={"right"}>
                    <NumericFormat
                      value={trn.tradeCashRate}
                      displayType={"text"}
                      decimalScale={4}
                      fixedDecimalScale={true}
                      thousandSeparator={true}
                    />
                  </td>
                  <td align={"right"}>
                    <NumericFormat
                      value={trn.tradePortfolioRate}
                      displayType={"text"}
                      decimalScale={4}
                      fixedDecimalScale={true}
                      thousandSeparator={true}
                    />
                  </td>

                  <td align={"right"}>
                    <NumericFormat
                      value={trn.cashAmount}
                      displayType={"text"}
                      decimalScale={2}
                      fixedDecimalScale={true}
                      thousandSeparator={true}
                    />
                  </td>

                  <td align={"right"}>
                    <NumericFormat
                      value={trn.tax}
                      displayType={"text"}
                      decimalScale={2}
                      fixedDecimalScale={true}
                      thousandSeparator={true}
                    />
                  </td>
                  <td align={"right"}>
                    <NumericFormat
                      value={trn.fees}
                      displayType={"text"}
                      decimalScale={2}
                      fixedDecimalScale={true}
                      thousandSeparator={true}
                    />
                  </td>
                  <td align={"left"}>
                    <Link
                      href={`/trns/trades/edit/${trn.portfolio.id}/${trn.id}`}
                      className="fa fa-edit"
                    ></Link>
                    <a
                      onClick={() => setDeleteTrnId(trn.id)}
                      className="simple-padding fa fa-trash-can"
                    ></a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {deleteTrnId && (
        <ConfirmDialog
          title={"Delete Transaction"}
          message={"Permanently delete this transaction?"}
          confirmLabel={"Delete"}
          cancelLabel={"Cancel"}
          variant="red"
          onConfirm={async () => {
            await deleteTrn(deleteTrnId)
            setDeleteTrnId(null)
          }}
          onCancel={() => setDeleteTrnId(null)}
        />
      )}
    </div>
  )
})
