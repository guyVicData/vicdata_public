// Teacher view Meetings, VicData 0.6 S7: one meeting (Meeting.dc.html, MeetingPlay.dc.html).
import { MeetingEditorScreen } from "@/components/meetings/MeetingEditor";

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MeetingEditorScreen id={id} />;
}
