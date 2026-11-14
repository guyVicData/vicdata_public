// VicData 0.8 review fixes (14 Nov, M1): the mainstream group dashboards' layout -- which view sits in
// which panel -- as plain data, so the group dashboard (GroupDashboard.tsx, a client component) and the
// walks' mini-maps (walks.ts: spotOf) read the one layout. The labels and icons stay with GROUP_VIEWS.
export type GroupLayoutDash = "overview" | "schools" | "academic" | "pupils";
export type GroupLayoutCell = { id: string; span: 1 | 2; views: string[] };

export const GROUP_LAYOUT_IDS: Record<GroupLayoutDash, { now: GroupLayoutCell[]; trends: GroupLayoutCell[] }> = {
  academic: {
    now: [
      { id: "a-now", span: 1, views: ["GRP-A-NOW"] },
      { id: "a-large", span: 2, views: ["GRP-A-RANKED", "GRP-A-AREAS", "GRP-A-VA"] },
    ],
    trends: [
      { id: "a-trend", span: 1, views: ["GRP-A-TREND"] },
      { id: "a-post16", span: 1, views: ["GRP-A-POST16"] },
      { id: "a-improving", span: 1, views: ["GRP-A-IMPROVING", "GRP-A-BANDS"] },
    ],
  },
  pupils: {
    now: [
      { id: "p-now", span: 1, views: ["GRP-P-NOW"] },
      { id: "p-large", span: 2, views: ["GRP-P-SHAPE", "GRP-P-ENTRIES", "GRP-P-LEAVING", "GRP-P-MARKET"] },
    ],
    trends: [
      { id: "p-roll", span: 1, views: ["GRP-P-ROLL"] },
      { id: "p-projection", span: 1, views: ["GRP-P-PROJECTION"] },
      { id: "p-growing", span: 1, views: ["GRP-P-GROWING"] },
    ],
  },
  overview: {
    now: [
      { id: "o-now", span: 1, views: ["GRP-O-NOW"] },
      { id: "o-large", span: 2, views: ["GRP-O-AGAINST", "GRP-O-MAP", "GRP-O-JOINED"] },
    ],
    trends: [
      { id: "o-roll", span: 1, views: ["GRP-O-ROLL"] },
      { id: "o-results", span: 1, views: ["GRP-O-RESULTS"] },
      { id: "o-share", span: 1, views: ["GRP-O-SHARE"] },
    ],
  },
  schools: {
    now: [
      { id: "s-now", span: 1, views: ["GRP-S-NOW"] },
      { id: "s-large", span: 2, views: ["GRP-S-TABLE", "GRP-O-MAP"] },
    ],
    trends: [
      { id: "s-growing", span: 1, views: ["GRP-S-GROWING"] },
      { id: "s-scatter", span: 1, views: ["GRP-S-SCATTER"] },
      { id: "s-shapes", span: 1, views: ["GRP-S-SHAPES"] },
    ],
  },
};
