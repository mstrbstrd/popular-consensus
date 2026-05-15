import { AppFrame } from "../../../components/AppFrame";
import { FeedPageClient } from "../../../components/SocialClient";

export default async function QuestionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AppFrame active="feed">
      <FeedPageClient questionId={id} />
    </AppFrame>
  );
}
