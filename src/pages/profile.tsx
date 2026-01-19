import { GetServerSideProps } from "next"

// Profile page redirects to unified settings page
// eslint-disable-next-line require-await
export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: "/settings",
    permanent: true,
  },
})

export default function Profile(): null {
  return null
}
