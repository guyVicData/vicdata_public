// Teacher view Meetings, VicData 0.6 S7: one meeting (Meeting.dc.html, MeetingPlay.dc.html).
// 0.6 E: slots draw their live figures (liveSlotRenderer) in the editor, Present, Grid
// view and the PDF.
import { MeetingEditorScreen } from "@/components/meetings/MeetingEditor";
import { LiveSlotRendererProvider } from "@/components/meetings/liveSlotRenderer";

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <LiveSlotRendererProvider>
      <MeetingEditorScreen id={id} />
    </LiveSlotRendererProvider>
  );
}
