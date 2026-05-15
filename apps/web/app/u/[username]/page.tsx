import { AppFrame } from "../../../components/AppFrame";
import { PublicProfilePageClient } from "../../../components/SocialClient";

type UserProfilePageProps = {
  params: Promise<{ username: string }>;
};

export default async function UserProfilePage({ params }: UserProfilePageProps) {
  const { username } = await params;
  return (
    <AppFrame active="feed">
      <PublicProfilePageClient username={decodeURIComponent(username)} />
    </AppFrame>
  );
}
