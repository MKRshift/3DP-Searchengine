import test from "node:test";
import assert from "node:assert/strict";

import { executeSearch, getSuggestions } from "../server/services/search.service.js";

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

test("executeSearch isolates provider failures while returning valid provider results", async () => {
  const providers = {
    good: {
      id: "good",
      label: "Good Provider",
      kind: "api",
      isPublic: true,
      isConfigured() {
        return true;
      },
      async search() {
        return [
          {
            source: "good",
            id: "1",
            title: "Valid Widget",
            url: "https://example.com/valid-widget",
            meta: { formats: ["stl"] },
          },
        ];
      },
    },
    bad: {
      id: "bad",
      label: "Bad Provider",
      kind: "api",
      isPublic: true,
      isConfigured() {
        return true;
      },
      async search() {
        return { broken: true };
      },
    },
  };

  const response = await executeSearch({
    query: { q: "widget", sources: "good,bad" },
    providers,
  });

  assert.equal(response.status, 200);
  assert.equal(response.payload.results.length, 1);
  assert.equal(response.payload.results[0].source, "good");
  assert.equal(response.payload.errors.length, 1);
  assert.equal(response.payload.errors[0].source, "bad");
  assert.match(response.payload.errors[0].message, /must be an array/i);
});


test("getSuggestions returns grouped payload", async () => {
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

  await executeSearch({ query: { q: "gear" }, providers });

  const suggestions = getSuggestions("ge");
  assert.ok(Array.isArray(suggestions.popular));
  assert.ok(Array.isArray(suggestions.recent));
  assert.ok(Array.isArray(suggestions.items));
  assert.ok(suggestions.recent.some((item) => /gear/i.test(item.title)));
});
