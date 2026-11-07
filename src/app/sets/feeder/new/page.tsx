import { redirect } from "next/navigation";

// VicData 0.8 sets round 1 (D18): the old feeder set builder is retired. Sets are made from a page's set
// menu (New set…) or the library at /sets, and saved to the one sets model (public.sets) -- this
// page wrote the old saved_sets table, which nothing new reads.
export default function RetiredFeederSetBuilder() {
  redirect("/sets");
}
