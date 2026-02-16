import test from "node:test";
import assert from "node:assert/strict";

import { AdapterValidationError, normalizeResult } from "../server/services/normalize.service.js";

test("normalizeResult maps source payload to shared schema", () => {
  const normalized = normalizeResult({
    source: "sketchfab",
    id: "abc",
    title: "Robot",
    url: "https://example.com/model",
    author: "maker",
    meta: {
      likes: 12,
      views: 300,
      downloads: 7,
      license: "CC-BY",
      formats: ["stl", "3mf"],
      publishedAt: "2025-01-01T12:00:00Z",
    },
  });

  assert.equal(normalized.source, "sketchfab");
  assert.equal(normalized.creatorName, "maker");
  assert.equal(normalized.stats.likes, 12);
  assert.equal(normalized.license, "CC-BY");
  assert.deepEqual(normalized.formats, ["stl", "3mf"]);
});

test("normalizeResult enforces adapter schema", () => {
  assert.throws(
    () =>
      normalizeResult({
        source: "bad-provider",
        title: "Broken",
        url: "notaurl",
      }),
    AdapterValidationError
  );
});
