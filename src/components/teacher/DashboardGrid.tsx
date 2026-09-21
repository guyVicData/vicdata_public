"use client";

// The dashboard's four question cards, in the laptop board's row
// (GCSE/Post16-Dashboard-Desktop.dc.html): four equal columns with a 2px divider column
// between each -- grid-template-columns 1fr 2px 1fr 2px 1fr 2px 1fr, gap 18px, aligned to
// the top. The mockups only draw 390px and 1280px, so the steps in between are a
// judgement call: stacked on a phone, paired from md, the full divided row from xl
// (1280px, the board's own width and max-w-7xl's). The dividers only exist at xl.
import { Children, Fragment, useCallback, useState, type ReactNode } from "react";
import { FullscreenReport } from "./CardBox";

// One of the three divider columns. While any box is fullscreen it goes invisible
// rather than unmounting, as the mockup hides its dividers then: removing the element
// would shift the cards into the 2px tracks and leave the grid broken under the modal.
function ColumnDivider({ hidden }: { hidden: boolean }) {
  return <div aria-hidden="true" className={`hidden self-stretch bg-[var(--divider)] xl:block ${hidden ? "invisible" : ""}`} />;
}

export function DashboardGrid({ children }: { children: ReactNode }) {
  // How many boxes are fullscreen right now, reported by CardBox -- including pinned boxes
  // deep inside ColumnBuilder. A count, not a flag, so closing one box never clears
  // another's state.
  const [openFullscreens, setOpenFullscreens] = useState(0);
  const report = useCallback((open: boolean) => setOpenFullscreens((n) => Math.max(0, n + (open ? 1 : -1))), []);
  const columns = Children.toArray(children);
  return (
    <FullscreenReport.Provider value={report}>
      <div className="mt-6 grid items-start gap-[18px] md:grid-cols-2 xl:grid-cols-[1fr_2px_1fr_2px_1fr_2px_1fr]">
        {columns.map((col, i) => (
          <Fragment key={i}>
            {i > 0 && <ColumnDivider hidden={openFullscreens > 0} />}
            {col}
          </Fragment>
        ))}
      </div>
    </FullscreenReport.Provider>
  );
}
