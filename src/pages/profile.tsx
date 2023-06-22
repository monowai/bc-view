import { UserProfile, useUser } from "@auth0/nextjs-auth0/client";
import Image from "next/image";
import { GetServerSideProps } from "next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { rootLoader } from "@core/common/PageLoader";
import { useTranslation } from "next-i18next";

export function getAvatar(user: UserProfile, size: number) {
  return (
    <Image
      src={user.picture as string}
      alt={user.name as string}
      style={{
        borderRadius: "50%",
        width: size,
        height: size,
        display: "block",
      }}
      priority={true}
      width={size}
      height={size}
    />
  );
}

export default function Profile(): JSX.Element {
  const { user, error, isLoading } = useUser();
  const { t, ready } = useTranslation("common");
  if (isLoading || !ready) return rootLoader(t("loading"));
  if (error) return <div>{error.message}</div>;
  if (!user) return <div>t("user.notfound")</div>;

  return (
    <div className={"box"}>
      <h1 className="subtitle">
        {user.nickname} / {user.email}
      </h1>
      {getAvatar(user, 50)}
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ locale }) => ({
  props: {
    ...(await serverSideTranslations(locale as string, ["common"])),
  },
});
