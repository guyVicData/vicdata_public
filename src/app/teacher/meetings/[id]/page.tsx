// Teacher view Meetings, VicData 0.6 S7: one meeting (Meeting.dc.html, MeetingPlay.dc.html).
// 0.6 E: slots draw their live figures (liveSlotRenderer) in the editor, Present, Grid
// view and the PDF. 0.6 integration: "Add a view" opens S4's chooser at Step 1
// (MeetingScreenWithChooser), pinned for the slot.
import { LiveSlotRendererProvider } from "@/components/meetings/liveSlotRenderer";
import { MeetingScreenWithChooser } from "@/components/meetings/MeetingAddView";

export default async function MeetingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <LiveSlotRendererProvider>
      <MeetingScreenWithChooser id={id} />
    </LiveSlotRendererProvider>
  );
}
