// VicData 0.8 front door (B11): a walk, full screen. One question at a time, each screen a dashboard view
// enlarged, ending on "Here's what you found".
import { WalkPage } from "@/components/front-door/WalkPage";

export default async function Walk({ params }: { params: Promise<{ walkId: string }> }) {
  const { walkId } = await params;
  return <WalkPage walkId={walkId} />;
}
