import { fetchText } from "../../lib/http.js";

function parseItems(html, limit) {
  const items = [];
  const re = /href="(\/object\/3d-print-[^"]+)"[^>]*>([\s\S]{0,240}?)/gi;
  let m;
  while ((m = re.exec(html)) && items.length < limit) {
    const path = m[1];
    const title = (m[2] || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    items.push({
      source: "mmf",
      id: path,
      title: title || "MyMiniFactory result",
      url: `https://www.myminifactory.com${path}`,
      thumbnail: null,
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
