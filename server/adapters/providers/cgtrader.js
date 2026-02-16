import { fetchText } from "../../lib/http.js";

function toAbsoluteUrl(url) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `https://www.cgtrader.com${url}`;
  return null;
}

function buildFallbackLink(q) {
  return {
    source: "cgtrader",
    id: `cgtrader:link:${q}`,
    title: `Search “${q}” on CGTrader`,
    url: `https://www.cgtrader.com/3d-models?keywords=${encodeURIComponent(q)}`,
    thumbnail: null,
    author: "Direct platform search",
    meta: { tags: ["external-search"] },
    score: 0.1,
  };
}

function parseItems(html, limit) {
  const items = [];
  const seen = new Set();
  const re = /href="(\/3d-models\/[^"?#]+)"[^>]*>/gi;
  let match;

  while ((match = re.exec(html)) && items.length < limit) {
    const path = match[1];
    if (seen.has(path)) continue;
    seen.add(path);

    const around = html.slice(Math.max(0, match.index - 1400), Math.min(html.length, match.index + 2200));
    const titleMatch = around.match(/(?:title|aria-label)="([^"]{3,200})"/i);
    const slug = path.split("/").pop() || "CGTrader result";
    const title = (titleMatch?.[1] || decodeURIComponent(slug).replace(/[-_]/g, " ")).trim();

    const srcsetMatch = around.match(/<img[^>]+srcset="([^"]+)"/i);
    const srcMatch = around.match(/<img[^>]+(?:src|data-src)="([^"]+)"/i);
    const srcsetUrl = srcsetMatch?.[1]?.split(",")?.pop()?.trim()?.split(" ")?.[0] || null;
    const thumbnail = toAbsoluteUrl(srcsetUrl || srcMatch?.[1] || "");

    items.push({
      source: "cgtrader",
      id: path,
      title,
      url: `https://www.cgtrader.com${path}`,
      thumbnail,
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
      try {
        const url = new URL("https://www.cgtrader.com/3d-models");
        url.searchParams.set("keywords", q);
        url.searchParams.set("page", String(page));
        const html = await fetchText(url.toString(), { timeoutMs: 15_000 });
        const items = parseItems(html, limit);
        return items.length ? items : [buildFallbackLink(q)];
      } catch {
        return [buildFallbackLink(q)];
      }
    },
  };
}
