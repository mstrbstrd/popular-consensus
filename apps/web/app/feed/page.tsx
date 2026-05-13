import { AppFrame } from "../../components/AppFrame";
import { FeedPageClient } from "../../components/SocialClient";

export default function FeedPage() {
  return (
    <AppFrame active="feed">
      <FeedPageClient />
    </AppFrame>
  );
}
