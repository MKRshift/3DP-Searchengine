import { fetchText } from "../../lib/http.js";
import { pickImageFromSnippet, titleFromPath } from "../../lib/htmlExtract.js";

function parseItems(html, limit) {
  const items = [];
  const seen = new Set();
  const re = /href="(\/object\/3d-print-[^"?#]+)"/gi;
  let match;

  while ((match = re.exec(html)) && items.length < limit) {
    const path = match[1];
    if (seen.has(path)) continue;
    seen.add(path);

    const around = html.slice(Math.max(0, match.index - 1200), Math.min(html.length, match.index + 2400));
    const titleMatch = around.match(/(?:title|aria-label)="([^"]{3,200})"/i);

    items.push({
      source: "mmf",
      id: path,
      title: (titleMatch?.[1] || titleFromPath(path, "MyMiniFactory result")).trim(),
      url: `https://www.myminifactory.com${path}`,
      thumbnail: pickImageFromSnippet(around, "https://www.myminifactory.com"),
      author: "",
      meta: {},
      score: 1,
    });
  }

  return items;
}

export function myMiniFactoryProvider() {
  return {
    id: "mmf",
    label: "MyMiniFactory",
    kind: "api",
    homepage: "https://www.myminifactory.com",
    iconUrl: "https://www.google.com/s2/favicons?domain=myminifactory.com&sz=64",
    searchUrlTemplate: "https://www.myminifactory.com/search/?query={q}",
    isPublic: true,
    notes: "Public search parser (tokenless)",
    isConfigured() {
      return true;
    },
    async search({ q, limit, page }) {
      const url = new URL("https://www.myminifactory.com/search/");
      url.searchParams.set("query", q);
      url.searchParams.set("page", String(page));
      const html = await fetchText(url.toString(), { timeoutMs: 15_000 });
      return parseItems(html, limit);
    },
  };
}
