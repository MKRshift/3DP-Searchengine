import { fetchText } from "../../lib/http.js";
import { pickImageFromSnippet, safeDecode, titleFromPath } from "../../lib/htmlExtract.js";

function buildSearchUrl(q) {
  const mode = (process.env.PRINTABLES_MODE || "all").toLowerCase();
  const base = mode === "free" ? "https://www.printables.com/search/models" : "https://www.printables.com/search/all-models";
  const url = new URL(base);
  url.searchParams.set("q", q);
  return url.toString();
}

function dedupe(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const key = it.url;
    if (key && !seen.has(key)) {
      seen.add(key);
      out.push(it);
    }
  }
  return out;
}

function parseResults(html, limit, q) {
  const items = [];
  const modelRe = /href="(\/model\/\d+-[^"?#\s]+)"/g;
  let match;
  while ((match = modelRe.exec(html)) && items.length < limit) {
    const path = match[1];
    const idx = match.index;
    const around = html.slice(Math.max(0, idx - 1200), Math.min(html.length, idx + 2200));

    let title = null;
    const titleAttrRe = new RegExp(`href="${path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*\\btitle="([^"]+)"`);
    const tAttr = around.match(titleAttrRe);
    if (tAttr && tAttr[1]) title = tAttr[1].trim();
    if (!title) title = titleFromPath(path, "Printables result");

    let author = "";
    const authorRe = /href="\/@([^"\/\s]+)"/;
    const a = around.match(authorRe);
    if (a && a[1]) author = safeDecode(a[1]);

    items.push({
      source: "printables",
      id: String(path),
      title,
      url: `https://www.printables.com${path}`,
      thumbnail: pickImageFromSnippet(around, "https://www.printables.com"),
      author,
      meta: {},
      score: 1,
    });
  }

  if (items.length === 0) {
    return [{
      source: "printables",
      id: `printables:link:${q}`,
      title: `Search “${q}” on Printables`,
      url: buildSearchUrl(q),
      thumbnail: "https://www.google.com/s2/favicons?domain=printables.com&sz=64",
      author: "Direct platform search",
      meta: { tags: ["external-search"] },
      score: 0.1,
    }];
  }

  return dedupe(items);
}

function parseMirrorMarkdown(md, limit) {
  const items = [];
  const seen = new Set();
  const re = /https:\/\/www\.printables\.com\/(model\/\d+-[^\s)\]]+)/gi;
  let match;
  while ((match = re.exec(md)) && items.length < limit) {
    const path = `/${match[1]}`;
    if (seen.has(path)) continue;
    seen.add(path);
    items.push({
      source: "printables",
      id: path,
      title: titleFromPath(path, "Printables result"),
      url: `https://www.printables.com${path}`,
      thumbnail: "https://www.google.com/s2/favicons?domain=printables.com&sz=64",
      author: "",
      meta: {},
      score: 1,
    });
  }
  return items;
}

export function printablesLinkProvider() {
  return {
    id: "printables",
    label: "Printables",
    kind: "api",
    mode: "api",
    homepage: "https://www.printables.com",
    iconUrl: "https://www.google.com/s2/favicons?domain=printables.com&sz=64",
    searchUrlTemplate: "https://www.printables.com/search/models?q={q}",
    isPublic: true,
    notes: "HTML search parser with mirror fallback; falls back to link",
    isConfigured() {
      return true;
    },
    async search({ q, limit, page }) {
      const perPage = Math.min(limit, 24);
      const url = buildSearchUrl(q) + `&page=${page}`;
      try {
        const html = await fetchText(url, { timeoutMs: 6_000, retries: 0 });
        return parseResults(html, perPage, q).slice(0, perPage);
      } catch {
        try {
          const mirror = await fetchText(`https://r.jina.ai/${url}`, { timeoutMs: 7_000, retries: 0 });
          const parsed = parseMirrorMarkdown(mirror, perPage);
          return parsed.length ? parsed : parseResults("", perPage, q).slice(0, perPage);
        } catch {
          return parseResults("", perPage, q).slice(0, perPage);
        }
      }
    },
  };
}
