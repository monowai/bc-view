import React from "react"

interface SkeletonLoaderProps {
  rows?: number
  showHeader?: boolean
}

export const TableSkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  rows = 5,
  showHeader = true,
}) => {
  const skeletonRows = Array.from({ length: rows }, (_, i) => i)

  return (
    <div className="w-full py-4 animate-pulse">
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full">
          {showHeader && (
            <thead className="bg-gray-100">
              <tr className="border-b border-gray-200">
                <th className="px-4 py-3 text-left">
                  <div className="h-4 bg-gray-300 rounded w-16"></div>
                </th>
                <th className="px-4 py-3 text-right hidden md:table-cell">
                  <div className="h-4 bg-gray-300 rounded w-12 ml-auto"></div>
                </th>
                <th className="px-4 py-3 text-right hidden md:table-cell">
                  <div className="h-4 bg-gray-300 rounded w-16 ml-auto"></div>
                </th>
                <th className="px-4 py-3 text-right">
                  <div className="h-4 bg-gray-300 rounded w-20 ml-auto"></div>
                </th>
                <th className="px-4 py-3 text-right hidden md:table-cell">
                  <div className="h-4 bg-gray-300 rounded w-16 ml-auto"></div>
                </th>
                <th className="px-4 py-3 text-right">
                  <div className="h-4 bg-gray-300 rounded w-24 ml-auto"></div>
                </th>
                <th className="px-4 py-3 text-right hidden md:table-cell">
                  <div className="h-4 bg-gray-300 rounded w-20 ml-auto"></div>
                </th>
                <th className="px-4 py-3 text-right">
                  <div className="h-4 bg-gray-300 rounded w-24 ml-auto"></div>
                </th>
                <th className="px-4 py-3 text-right hidden md:table-cell">
                  <div className="h-4 bg-gray-300 rounded w-20 ml-auto"></div>
                </th>
                <th className="px-4 py-3 text-right hidden xl:table-cell">
                  <div className="h-4 bg-gray-300 rounded w-12 ml-auto"></div>
                </th>
                <th className="px-4 py-3 text-right hidden xl:table-cell">
                  <div className="h-4 bg-gray-300 rounded w-16 ml-auto"></div>
                </th>
                <th className="px-4 py-3 text-right">
                  <div className="h-4 bg-gray-300 rounded w-20 ml-auto"></div>
                </th>
              </tr>
            </thead>
          )}
          <tbody className="divide-y divide-gray-200">
            {skeletonRows.map((_, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="h-4 bg-gray-200 rounded w-16"></div>
                </td>
                <td className="px-4 py-3 text-right hidden md:table-cell">
                  <div className="h-4 bg-gray-200 rounded w-12 ml-auto"></div>
                </td>
                <td className="px-4 py-3 text-right hidden md:table-cell">
                  <div className="h-4 bg-gray-200 rounded w-16 ml-auto"></div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="h-4 bg-gray-200 rounded w-20 ml-auto"></div>
                </td>
                <td className="px-4 py-3 text-right hidden md:table-cell">
                  <div className="h-4 bg-gray-200 rounded w-16 ml-auto"></div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="h-4 bg-gray-200 rounded w-24 ml-auto"></div>
                </td>
                <td className="px-4 py-3 text-right hidden md:table-cell">
                  <div className="h-4 bg-gray-200 rounded w-20 ml-auto"></div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="h-4 bg-gray-200 rounded w-24 ml-auto"></div>
                </td>
                <td className="px-4 py-3 text-right hidden md:table-cell">
                  <div className="h-4 bg-gray-200 rounded w-20 ml-auto"></div>
                </td>
                <td className="px-4 py-3 text-right hidden xl:table-cell">
                  <div className="h-4 bg-gray-200 rounded w-12 ml-auto"></div>
                </td>
                <td className="px-4 py-3 text-right hidden xl:table-cell">
                  <div className="h-4 bg-gray-200 rounded w-16 ml-auto"></div>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="h-4 bg-gray-200 rounded w-20 ml-auto"></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export const SummarySkeletonLoader: React.FC = () => (
  <div className="animate-pulse">
    <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden mb-3">
      <table className="min-w-full">
        <thead className="bg-gray-100">
          <tr>
            <th className="px-4 py-3 text-left">
              <div className="h-5 bg-gray-300 rounded w-32"></div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="px-4 py-3">
              <div className="flex justify-between items-center">
                <div className="h-4 bg-gray-200 rounded w-24"></div>
                <div className="h-4 bg-gray-200 rounded w-32"></div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
)

export const SkeletonBar: React.FC<{ width?: string; height?: string }> = ({
  width = "w-full",
  height = "h-4",
}) => (
  <div className={`${width} ${height} bg-gray-200 rounded animate-pulse`}></div>
)
