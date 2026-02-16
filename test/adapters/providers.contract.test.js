import test from "node:test";
import assert from "node:assert/strict";

import { sketchfabProvider } from "../../server/adapters/providers/sketchfab.js";
import { myMiniFactoryProvider } from "../../server/adapters/providers/myminifactory.js";
import { cgtraderProvider } from "../../server/adapters/providers/cgtrader.js";
import { cultsProvider } from "../../server/adapters/providers/cults.js";
import { thingiverseProvider } from "../../server/adapters/providers/thingiverse.js";
import { nasaProvider } from "../../server/adapters/providers/nasa.js";
import { smithsonianProvider } from "../../server/adapters/providers/smithsonian.js";

function jsonResponse(payload, { status = 200, statusText = "OK", contentType = "application/json" } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: { get: (name) => (name.toLowerCase() === "content-type" ? contentType : null) },
    async json() {
      return payload;
    },
    async text() {
      return typeof payload === "string" ? payload : JSON.stringify(payload);
    },
  };
}


function textResponse(payload, { status = 200, statusText = "OK", contentType = "text/html" } = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    headers: { get: (name) => (name.toLowerCase() === "content-type" ? contentType : null) },
    async json() {
      return JSON.parse(payload);
    },
    async text() {
      return payload;
    },
  };
}

function withMockFetch(sequence, fn) {
  const original = global.fetch;
  const calls = [];
  global.fetch = async (...args) => {
    calls.push(args);
    const next = sequence.shift();
    if (next instanceof Error) throw next;
    if (!next) throw new Error("Missing mock response");
    return next;
  };
  return Promise.resolve()
    .then(() => fn(calls))
    .finally(() => {
      global.fetch = original;
    });
}

const requiredKeys = ["source", "id", "title", "url", "meta", "score"];

function assertContractShape(results, source) {
  assert.ok(Array.isArray(results));
  for (const item of results) {
    for (const key of requiredKeys) {
      assert.ok(Object.hasOwn(item, key), `${source} result missing ${key}`);
    }
    assert.equal(item.source, source);
    assert.equal(typeof item.id, "string");
    assert.equal(typeof item.title, "string");
    assert.equal(typeof item.score, "number");
  }
}

test("api adapters return normalized contract fields on success", async () => {
  await withMockFetch([
    jsonResponse({ results: [{ uid: "s1", name: "Sketch Gear", viewerUrl: "https://sketchfab.com/models/s1", user: { username: "alice" }, likeCount: 12, viewCount: 300 }] }),
    textResponse('<a href="/object/3d-print-mmf-gear">MMF Gear</a>'),
    textResponse('<a href="/3d-models/cg-gear" title="CG Gear">CG</a>'),
    textResponse('<a href="/en/3d-model/cults-gear">Cults</a>'),
    textResponse('<a href="/thing:14" title="Thing Gear">Thing</a>'),
    jsonResponse({ tree: [{ type: "blob", path: "models/gear.stl", sha: "sha-gear" }] }),
    jsonResponse({ response: { rows: [{ id: "si-15", title: "Smith Gear", content: { descriptiveNonRepeating: { record_link: "https://si.example/15", online_media: { media: [{ thumbnail: "https://si.example/thumb.png" }] } } } }] } }),
  ], async () => {
    const sketch = await sketchfabProvider().search({ q: "gear", limit: 5, page: 1 });
    const mmf = await myMiniFactoryProvider().search({ q: "gear", limit: 5, page: 1 });
    const cg = await cgtraderProvider().search({ q: "gear", limit: 5, page: 1 });
    const cults = await cultsProvider().search({ q: "gear", limit: 5, page: 1 });
    const thingiverse = await thingiverseProvider().search({ q: "gear", limit: 5, page: 1 });
    const nasa = await nasaProvider().search({ q: "gear", limit: 5, page: 1 });
    const si = await smithsonianProvider().search({ q: "gear", limit: 5, page: 1 });

    assertContractShape(sketch, "sketchfab");
    assertContractShape(mmf, "mmf");
    assertContractShape(cg, "cgtrader");
    assertContractShape(cults, "cults");
    assertContractShape(thingiverse, "thingiverse");
    assertContractShape(nasa, "nasa");
    assertContractShape(si, "smithsonian");
  });
});

test("adapters gracefully degrade malformed payloads to empty arrays", async () => {
  await withMockFetch([
    jsonResponse({ unexpected: true }),
    textResponse("<html></html>"),
    textResponse("<html></html>"),
    textResponse("<html></html>"),
    textResponse("<html></html>"),
    jsonResponse({ tree: [{ type: "tree", path: "docs/readme.md" }] }),
    jsonResponse({ response: {} }),
  ], async () => {
    assert.deepEqual(await sketchfabProvider().search({ q: "gear", limit: 5, page: 1 }), []);
    assert.deepEqual(await myMiniFactoryProvider().search({ q: "gear", limit: 5, page: 1 }), []);
    assert.deepEqual(await cgtraderProvider().search({ q: "gear", limit: 5, page: 1 }), []);
    assert.deepEqual(await cultsProvider().search({ q: "gear", limit: 5, page: 1 }), []);
    assert.deepEqual(await thingiverseProvider().search({ q: "gear", limit: 5, page: 1 }), []);
    assert.deepEqual(await nasaProvider().search({ q: "unmatched", limit: 5, page: 1 }), []);
    assert.deepEqual(await smithsonianProvider().search({ q: "gear", limit: 5, page: 1 }), []);
  });
});

test("adapters surface timeout and 429/5xx errors from HTTP client", async () => {
  await withMockFetch(
    [
      jsonResponse({ message: "busy" }, { status: 429, statusText: "Too Many Requests" }),
      jsonResponse({ message: "down" }, { status: 503, statusText: "Service Unavailable" }),
      jsonResponse({ message: "still down" }, { status: 500, statusText: "Internal Server Error" }),
    ],
    async () => {
      await assert.rejects(
        sketchfabProvider().search({ q: "gear", limit: 5, page: 1 }),
        /HTTP 500 Internal Server Error/i,
      );
    },
  );

  await withMockFetch(
    [
      new Error("fetch failed"),
      new Error("fetch failed"),
      new DOMException("The operation was aborted", "AbortError"),
    ],
    async () => {
      await assert.rejects(
        sketchfabProvider().search({ q: "gear", limit: 5, page: 1 }),
        /abort|fetch failed/i,
      );
    },
  );
});
