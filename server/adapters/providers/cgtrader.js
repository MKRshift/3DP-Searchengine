import { fetchText } from "../../lib/http.js";
import { pickImageFromSnippet, titleFromPath } from "../../lib/htmlExtract.js";

function slugifyQuery(q) {
  return String(q || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "3d-models";
}

function buildFallbackLink(q, { captcha = false } = {}) {
  return {
    source: "cgtrader",
    id: `cgtrader:link:${q}`,
    title: captcha ? `CGTrader verification required — open search for “${q}”` : `Search “${q}” on CGTrader`,
    url: `https://www.cgtrader.com/3d-models/${slugifyQuery(q)}`,
    thumbnail: "https://www.google.com/s2/favicons?domain=cgtrader.com&sz=64",
    author: captcha ? "CAPTCHA / anti-bot challenge" : "Direct platform search",
    meta: { tags: ["external-search", ...(captcha ? ["captcha"] : [])] },
    score: 0.1,
  };
}

function parseItems(html, limit) {
  const items = [];
  const seen = new Set();
  const re = /href="(\/3d-models\/[^"]+)"[^>]*>/gi;
  let match;

  while ((match = re.exec(html)) && items.length < limit) {
    const path = match[1].split("?")[0];
    if (seen.has(path)) continue;
    seen.add(path);

    const around = html.slice(Math.max(0, match.index - 1400), Math.min(html.length, match.index + 2200));
    const titleMatch = around.match(/(?:title|aria-label)="([^"]{3,200})"/i);
    const thumbnail = pickImageFromSnippet(around, "https://www.cgtrader.com");

    items.push({
      source: "cgtrader",
      id: path,
      title: (titleMatch?.[1] || titleFromPath(path, "CGTrader result")).trim(),
      url: `https://www.cgtrader.com${path}`,
      thumbnail,
      author: "",
      meta: {},
      score: 1,
    });
  }

  return items;
}

function parseMirrorMarkdown(md, limit) {
  const items = [];
  const seen = new Set();
  const re = /https:\/\/www\.cgtrader\.com\/(3d-models\/[a-z0-9][^\s)\]]+)/gi;
  let match;
  while ((match = re.exec(md)) && items.length < limit) {
    const path = `/${match[1].split("?")[0]}`;
    if (seen.has(path)) continue;
    seen.add(path);
    items.push({
      source: "cgtrader",
      id: path,
      title: titleFromPath(path, "CGTrader result"),
      url: `https://www.cgtrader.com${path}`,
      thumbnail: "https://www.google.com/s2/favicons?domain=cgtrader.com&sz=64",
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
    searchUrlTemplate: "https://www.cgtrader.com/3d-models/{q}",
    isPublic: true,
    notes: "Public search parser with mirror fallback (tokenless)",
    isConfigured() {
      return true;
    },
    async search({ q, limit }) {
      const slug = slugifyQuery(q);
      const directUrl = `https://www.cgtrader.com/3d-models/${slug}`;
      try {
        const html = await fetchText(directUrl, { timeoutMs: 15_000 });
        const items = parseItems(html, limit);
        if (items.length) return items;
      } catch {
        // fallback below
      }

      try {
        const mirror = await fetchText(`https://r.jina.ai/${directUrl}`, { timeoutMs: 20_000, retries: 0 });
        const items = parseMirrorMarkdown(mirror, limit);
        if (items.length) return items;
        if (/requiring CAPTCHA|security verification|Just a moment/i.test(mirror)) return [buildFallbackLink(q, { captcha: true })];
      } catch {
        // fallback
      }

      return [buildFallbackLink(q)];
    },
  };
}
