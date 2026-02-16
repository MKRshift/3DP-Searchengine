import { fetchText } from "../../lib/http.js";

function toAbsoluteUrl(url) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `https://cults3d.com${url}`;
  return null;
}

function parseItems(html, limit) {
  const items = [];
  const seen = new Set();
  const re = /href="(\/[a-z]{2}\/3d-model\/[^"?#]+)"/gi;
  let match;

  while ((match = re.exec(html)) && items.length < limit) {
    const path = match[1];
    if (seen.has(path)) continue;
    seen.add(path);

    const around = html.slice(Math.max(0, match.index - 1500), Math.min(html.length, match.index + 2600));
    const slug = path.split("/").pop() || "cults result";
    const titleMatch = around.match(/(?:title|aria-label)="([^"]{3,200})"/i);

    const srcsetMatch = around.match(/<img[^>]+srcset="([^"]+)"/i);
    const srcMatch = around.match(/<img[^>]+(?:src|data-src)="([^"]+)"/i);
    const srcsetUrl = srcsetMatch?.[1]?.split(",")?.pop()?.trim()?.split(" ")?.[0] || null;
    const thumbnail = toAbsoluteUrl(srcsetUrl || srcMatch?.[1] || "");

    items.push({
      source: "cults",
      id: path,
      title: (titleMatch?.[1] || decodeURIComponent(slug).replace(/[-_]/g, " ")).trim(),
      url: `https://cults3d.com${path}`,
      thumbnail,
      author: "",
      meta: {},
      score: 1,
    });
  }

  return items;
}

export function cultsProvider() {
  return {
    id: "cults",
    label: "Cults3D",
    kind: "api",
    homepage: "https://cults3d.com",
    iconUrl: "https://www.google.com/s2/favicons?domain=cults3d.com&sz=64",
    searchUrlTemplate: "https://cults3d.com/en/search?q={q}",
    isPublic: true,
    notes: "Public search parser (tokenless)",
    isConfigured() {
      return true;
    },
    async search({ q, limit, page }) {
      const url = new URL("https://cults3d.com/en/search");
      url.searchParams.set("q", q);
      url.searchParams.set("page", String(page));
      const html = await fetchText(url.toString(), { timeoutMs: 15_000 });
      return parseItems(html, limit);
    },
  };
}
