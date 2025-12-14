import React from "react"
import { useRouter } from "next/router"

function HeaderBrand(): React.ReactElement {
  const router = useRouter()
  return (
    <div className="flex items-center">
      <a
        className="text-xl font-bold cursor-pointer"
        onClick={() => {
          router.push("/")
        }}
      >
        Holds<i>worth</i>
        {/*<img src={Logo} />*/}
      </a>
      <div className="ml-4 cursor-pointer">
        <span className="block w-6 h-1 bg-gray-800 mb-2"></span>
        <span className="block w-6 h-1 bg-gray-800 mb-1"></span>
        <span className="block w-6 h-1 bg-gray-800"></span>
      </div>
    </div>
  )
}

export default HeaderBrand
