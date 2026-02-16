import { fetchText } from "../../lib/http.js";
import { pickImageFromSnippet } from "../../lib/htmlExtract.js";

function parseItems(html, limit) {
  const items = [];
  const seen = new Set();
  const re = /href="(\/thing:[0-9]+)"/gi;
  let match;

  while ((match = re.exec(html)) && items.length < limit) {
    const path = match[1];
    if (seen.has(path)) continue;
    seen.add(path);

    const around = html.slice(Math.max(0, match.index - 1500), Math.min(html.length, match.index + 2600));
    const titleMatch = around.match(/(?:title|aria-label)="([^"]+)"/i);
    items.push({
      source: "thingiverse",
      id: path.replace("/thing:", ""),
      title: titleMatch?.[1] || `Thingiverse ${path.replace("/thing:", "#")}`,
      url: `https://www.thingiverse.com${path}`,
      thumbnail: pickImageFromSnippet(around, "https://www.thingiverse.com"),
      author: "",
      meta: {},
      score: 1,
    });
  }
  return items;
}

export function thingiverseProvider() {
  return {
    id: "thingiverse",
    label: "Thingiverse",
    kind: "api",
    homepage: "https://www.thingiverse.com",
    iconUrl: "https://www.google.com/s2/favicons?domain=thingiverse.com&sz=64",
    searchUrlTemplate: "https://www.thingiverse.com/search?q={q}",
    isPublic: true,
    notes: "Public search parser (tokenless)",
    isConfigured() {
      return true;
    },
    async search({ q, limit, page }) {
      const url = new URL("https://www.thingiverse.com/search");
      url.searchParams.set("q", q);
      url.searchParams.set("page", String(page));
      const html = await fetchText(url.toString(), { timeoutMs: 15_000 });
      return parseItems(html, limit);
    },
  };
}
