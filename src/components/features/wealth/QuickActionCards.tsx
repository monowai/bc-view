import React, { useState } from "react"
import Link from "next/link"
import PayslipModal from "@components/features/transactions/PayslipModal"

interface QuickActionCardsProps {
  // In zen mode the Aggregated Holdings card is redundant (a single
  // portfolio's holdings == the aggregate), so swap it for a Pay Slip action.
  zenMode?: boolean
}

const QuickActionCards: React.FC<QuickActionCardsProps> = ({
  zenMode = false,
}) => {
  const [payslipOpen, setPayslipOpen] = useState(false)
  return (
    <>
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        {zenMode ? (
          <button
            type="button"
            onClick={() => setPayslipOpen(true)}
            className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow group text-left"
          >
            <div className="flex items-center">
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mr-4 group-hover:bg-amber-200 transition-colors">
                <i className="fas fa-file-invoice-dollar text-amber-700 text-xl"></i>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Pay Slip</p>
                <p className="text-sm text-gray-500">
                  Record salary &amp; contributions
                </p>
              </div>
            </div>
          </button>
        ) : (
          <Link
            href="/holdings/aggregated"
            className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow group"
          >
            <div className="flex items-center">
              <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center mr-4 group-hover:bg-amber-200 transition-colors">
                <i className="fas fa-layer-group text-amber-700 text-xl"></i>
              </div>
              <div>
                <p className="font-semibold text-gray-900">
                  Aggregated Holdings
                </p>
                <p className="text-sm text-gray-500">
                  View all holdings combined
                </p>
              </div>
            </div>
          </Link>
        )}

        <Link
          href="/rebalance/wizard"
          className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow group"
        >
          <div className="flex items-center">
            <div className="w-12 h-12 bg-violet-100 rounded-lg flex items-center justify-center mr-4 group-hover:bg-violet-200 transition-colors">
              <i className="fas fa-balance-scale text-violet-700 text-xl"></i>
            </div>
            <div>
              <p className="font-semibold text-gray-900">Rebalance</p>
              <p className="text-sm text-gray-500">
                Align to target allocations
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/accounts"
          className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow group"
        >
          <div className="flex items-center">
            <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center mr-4 group-hover:bg-emerald-200 transition-colors">
              <i className="fas fa-gem text-emerald-700 text-xl"></i>
            </div>
            <div>
              <p className="font-semibold text-gray-900">Custom Assets</p>
              <p className="text-sm text-gray-500">Property, accounts & more</p>
            </div>
          </div>
        </Link>
      </div>

      {zenMode && (
        <PayslipModal
          modalOpen={payslipOpen}
          onClose={() => setPayslipOpen(false)}
        />
      )}
    </>
  )
}

export default QuickActionCards
