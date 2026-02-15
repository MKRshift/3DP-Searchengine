import test from "node:test";
import assert from "node:assert/strict";

import { rankAndDedupe } from "../src/lib/rank.js";

test("rankAndDedupe merges canonical duplicates across providers", () => {
  const results = rankAndDedupe([
    { source: "a", id: "1", title: "Hello Gear", creatorName: "Jane", url: "https://a/1", score: 10 },
    { source: "b", id: "9", title: "Hello Gear", creatorName: "Jane", url: "https://b/9", score: 9 },
  ]);

  assert.equal(results.length, 1);
  assert.deepEqual(results[0].alsoFoundOn.sort(), ["a", "b"]);
});
