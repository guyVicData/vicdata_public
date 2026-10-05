// VicData 0.6.1 S6: the config-driven renderer (v2) is the default; ?views=v1 is the escape hatch.
import { test } from "node:test";
import assert from "node:assert/strict";
import { viewsV2Requested } from "@/components/views/flag";

test("v2 is the default; ?views=v1 (or NEXT_PUBLIC_VIEWS=v1) turns it off", () => {
  const before = process.env.NEXT_PUBLIC_VIEWS;
  try {
    delete process.env.NEXT_PUBLIC_VIEWS;
    assert.equal(viewsV2Requested(null), true);
    assert.equal(viewsV2Requested(new URLSearchParams("")), true);
    assert.equal(viewsV2Requested(new URLSearchParams("views=v2")), true);
    assert.equal(viewsV2Requested(new URLSearchParams("views=v1")), false);
    process.env.NEXT_PUBLIC_VIEWS = "v1";
    assert.equal(viewsV2Requested(null), false);
    assert.equal(viewsV2Requested(new URLSearchParams("views=v2")), true);
    process.env.NEXT_PUBLIC_VIEWS = "v2";
    assert.equal(viewsV2Requested(new URLSearchParams("views=v1")), false);
  } finally {
    if (before === undefined) delete process.env.NEXT_PUBLIC_VIEWS;
    else process.env.NEXT_PUBLIC_VIEWS = before;
  }
});
