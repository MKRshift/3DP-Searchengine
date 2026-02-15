import test from "node:test";
import assert from "node:assert/strict";

import { parseAdvancedQuery } from "../src/lib/query.js";

test("parseAdvancedQuery extracts provider/type/filter tokens", () => {
  const parsed = parseAdvancedQuery("source:sketchfab type:laser format:svg free gift box");

  assert.equal(parsed.queryText, "free gift box");
  assert.deepEqual(parsed.parsed.source, ["sketchfab"]);
  assert.equal(parsed.parsed.type, "laser");
  assert.equal(parsed.parsed.format, "svg");
  assert.equal(parsed.chips.length, 3);
});
