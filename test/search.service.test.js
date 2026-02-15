import test from "node:test";
import assert from "node:assert/strict";

import { executeSearch } from "../src/services/search.service.js";

test("executeSearch returns link results for link providers", async () => {
  const providers = {
    printables: {
      id: "printables",
      label: "Printables",
      kind: "link",
      searchUrlTemplate: "https://example.com/search?q={q}",
      isConfigured() {
        return true;
      },
    },
  };

  const response = await executeSearch({ query: { q: "gear" }, providers });

  assert.equal(response.status, 200);
  assert.equal(response.payload.results.length, 0);
  assert.equal(response.payload.linkResults.length, 1);
  assert.match(response.payload.linkResults[0].title, /gear/i);
});
