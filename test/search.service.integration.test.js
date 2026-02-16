import test from "node:test";
import assert from "node:assert/strict";

import { executeSearch } from "../server/services/search.service.js";

test("executeSearch merges, ranks, dedupes across adapters and degrades gracefully", async () => {
  const providers = {
    sketchfab: {
      id: "sketchfab",
      label: "Sketchfab",
      kind: "api",
      isPublic: true,
      isConfigured() {
        return true;
      },
      async search() {
        return [
          {
            source: "sketchfab",
            id: "s1",
            title: "Planetary Gear",
            url: "https://shared.example/gear",
            creatorName: "Alice",
            meta: { likes: 20, downloads: 10 },
            score: 120,
          },
        ];
      },
    },
    thingiverse: {
      id: "thingiverse",
      label: "Thingiverse",
      kind: "api",
      isPublic: true,
      isConfigured() {
        return true;
      },
      async search() {
        return [
          {
            source: "thingiverse",
            id: "t1",
            title: "Planetary Gear",
            url: "https://alt.example/gear-v2",
            creatorName: "Alice",
            meta: { likes: 7, downloads: 2 },
            score: 90,
          },
          {
            source: "thingiverse",
            id: "t2",
            title: "Clamp",
            url: "https://alt.example/clamp",
            creatorName: "Bob",
            meta: { likes: 2 },
            score: 30,
          },
        ];
      },
    },
    broken: {
      id: "broken",
      label: "Broken",
      kind: "api",
      isPublic: true,
      isConfigured() {
        return true;
      },
      async search() {
        throw new Error("timeout while requesting provider");
      },
    },
    malformed: {
      id: "malformed",
      label: "Malformed",
      kind: "api",
      isPublic: true,
      isConfigured() {
        return true;
      },
      async search() {
        return { bad: true };
      },
    },
    privateDisabled: {
      id: "privateDisabled",
      label: "Private Disabled",
      kind: "api",
      isPublic: false,
      isConfigured() {
        return false;
      },
      async search() {
        throw new Error("should not execute");
      },
    },
  };

  const response = await executeSearch({
    query: { q: "planetary", sources: "sketchfab,thingiverse,broken,malformed,privateDisabled", sort: "relevant", limit: 10 },
    providers,
  });

  assert.equal(response.status, 200);
  assert.equal(response.payload.results.length, 2);

  const [mergedResult] = response.payload.results;
  assert.equal(mergedResult.title, "Planetary Gear");
  assert.deepEqual(mergedResult.alsoFoundOn.sort(), ["sketchfab", "thingiverse"]);
  assert.equal(mergedResult.source, "sketchfab");

  assert.equal(response.payload.errors.length, 2);
  assert.deepEqual(
    response.payload.errors.map((entry) => entry.source).sort(),
    ["broken", "malformed"],
  );

  const statusById = new Map(response.payload.providerStatus.map((entry) => [entry.id, entry.state]));
  assert.equal(statusById.get("sketchfab"), "ok");
  assert.equal(statusById.get("thingiverse"), "ok");
  assert.equal(statusById.get("broken"), "error");
  assert.equal(statusById.get("malformed"), "error");
  assert.equal(statusById.get("privateDisabled"), "warn");
});
