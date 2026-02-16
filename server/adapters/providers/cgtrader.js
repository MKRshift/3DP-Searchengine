import { fetchText } from "../../lib/http.js";

function parseItems(html, limit) {
  const items = [];
  const re = /href="(\/3d-models\/[^"]+)"[^>]*>/gi;
  let m;
  while ((m = re.exec(html)) && items.length < limit) {
    const path = m[1];
    const around = html.slice(Math.max(0, m.index - 250), Math.min(html.length, m.index + 400));
    const titleMatch = around.match(/title="([^"]+)"/i);
    const title = (titleMatch?.[1] || path.split("/").pop() || "CGTrader result").replace(/-/g, " ");
    items.push({
      source: "cgtrader",
      id: path,
      title,
      url: `https://www.cgtrader.com${path}`,
      thumbnail: null,
      author: "",
      meta: {},
      score: 1,
    });
  }
  return items;
}

export function cgtraderProvider() {
  return {
    id: "cgtrader",
    label: "CGTrader",
    kind: "api",
    homepage: "https://www.cgtrader.com",
    iconUrl: "https://www.google.com/s2/favicons?domain=cgtrader.com&sz=64",
    searchUrlTemplate: "https://www.cgtrader.com/3d-models?keywords={q}",
    isPublic: true,
    notes: "Public search parser (tokenless)",
    isConfigured() {
      return true;
    },
    async search({ q, limit, page }) {
      const url = new URL("https://www.cgtrader.com/3d-models");
      url.searchParams.set("keywords", q);
      url.searchParams.set("page", String(page));
      const html = await fetchText(url.toString(), { timeoutMs: 15_000 });
      return parseItems(html, limit);
    },
  };
}
