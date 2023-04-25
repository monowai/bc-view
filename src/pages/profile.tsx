// noinspection JSUnusedGlobalSymbols

import { useUser } from "@auth0/nextjs-auth0/client";
import Image from "next/image";
import { GetServerSideProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";

export default function Profile(): JSX.Element {
  const { user, error, isLoading } = useUser();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>{error.message}</div>;
  if (!user) return <div>User does not exist</div>;

  return (
    <div>
      <Image
        src={user.picture as string}
        alt={user.name as string}
        width={500}
        height={500}
      />
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
});
