import { fetchJson, fetchText } from "../../lib/http.js";
import { pickImageFromSnippet, toAbsoluteUrl, titleFromPath } from "../../lib/htmlExtract.js";

function pickThumb(it) {
  const candidates = [
    it?.coverUrl,
    it?.cover_url,
    it?.imageUrl,
    it?.image_url,
    it?.image,
    it?.thumb,
  ].filter(Boolean);
  return toAbsoluteUrl(candidates[0] ?? null, "https://makerworld.com");
}

function sortToOrderBy(sort) {
  switch ((sort || "").toLowerCase()) {
    case "downloads":
      return "downloadCount";
    case "likes":
      return "likeCount";
    case "views":
      return "viewCount";
    case "newest":
      return "newUploads";
    case "trending":
      return "hotScore";
    default:
      return "score";
  }
}

function buildPublicUrl(id, slug) {
  if (!id) return null;
  const suffix = slug ? `-${slug}` : "";
  return `https://makerworld.com/en/models/${id}${suffix}`;
}

function buildFallbackLink(q) {
  return {
    source: "makerworld",
    id: `makerworld:link:${q}`,
    title: `Search “${q}” on MakerWorld`,
    url: `https://makerworld.com/en/search/models?keyword=${encodeURIComponent(q)}`,
    thumbnail: "https://www.google.com/s2/favicons?domain=makerworld.com&sz=64",
    author: "Direct platform search",
    meta: { tags: ["external-search"] },
    score: 0.1,
  };
}

function extractItems(data) {
  if (!data || typeof data !== "object") return [];
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.list)) return data.list;
  if (Array.isArray(data.results)) return data.results;
  if (Array.isArray(data.content)) return data.content;
  if (Array.isArray(data.data?.items)) return data.data.items;
  if (Array.isArray(data.data?.list)) return data.data.list;
  return [];
}

function parseHtmlFallback(html, limit) {
  const items = [];
  const seen = new Set();
  const re = /href="(\/en\/models\/[0-9][^"?#]*)"/gi;
  let match;

  while ((match = re.exec(html)) && items.length < limit) {
    const path = match[1];
    if (seen.has(path)) continue;
    seen.add(path);

    const around = html.slice(Math.max(0, match.index - 1800), Math.min(html.length, match.index + 2800));
    const titleMatch = around.match(/(?:title|aria-label)="([^"]{3,200})"/i);

    items.push({
      source: "makerworld",
      id: path,
      title: (titleMatch?.[1] || titleFromPath(path, "MakerWorld result")).trim(),
      url: `https://makerworld.com${path}`,
      thumbnail: pickImageFromSnippet(around, "https://makerworld.com"),
      author: "",
      meta: {},
      score: 1,
    });
  }

  return items;
}

export function makerworldLinkProvider() {
  const searchUrlTemplate = "https://makerworld.com/en/search/models?keyword={q}";
  const override = process.env.MAKERWORLD_SEARCH_URL?.trim() || "";
  const authHeader = process.env.MAKERWORLD_AUTH_HEADER?.trim() || "";
  const authValue = process.env.MAKERWORLD_AUTH_VALUE?.trim() || "";
  return {
    id: "makerworld",
    label: "MakerWorld",
    kind: "api",
    mode: "api",
    homepage: "https://makerworld.com",
    iconUrl: "https://www.google.com/s2/favicons?domain=makerworld.com&sz=64",
    searchUrlTemplate,
    isPublic: true,
    notes: override
      ? "using MAKERWORLD_SEARCH_URL override ✅"
      : "public JSON search endpoint with HTML fallback; falls back to link if unavailable",
    isConfigured() {
      return true;
    },
    async search({ q, limit, page, sort }) {
      const perPage = Math.min(limit, 24);
      const orderBy = sortToOrderBy(sort);

      const headers = {};
      if (authHeader && authValue) headers[authHeader] = authValue;

      const candidates = [];
      if (override) {
        let url = override;
        url = url.replaceAll("{q}", encodeURIComponent(q));
        url = url.replaceAll("{keyword}", encodeURIComponent(q));
        url = url.replaceAll("{orderBy}", encodeURIComponent(orderBy));
        url = url.replaceAll("{page}", String(page));
        url = url.replaceAll("{size}", String(perPage));
        url = url.replaceAll("{perPage}", String(perPage));
        candidates.push(url);
      } else {
        candidates.push(
          `https://makerworld.com/api/v1/search?keyword=${encodeURIComponent(q)}&scene=models&orderBy=${encodeURIComponent(orderBy)}&page=${page}&size=${perPage}`,
          `https://makerworld.com/api/v1/search/models?keyword=${encodeURIComponent(q)}&orderBy=${encodeURIComponent(orderBy)}&page=${page}&size=${perPage}`,
          `https://makerworld.com/api/v1/search?keyword=${encodeURIComponent(q)}&scene=models&orderBy=${encodeURIComponent(orderBy)}&p=${page}&pageSize=${perPage}`,
        );
      }

      let data = null;
      for (const url of candidates) {
        try {
          data = await fetchJson(url, { timeoutMs: 6_000, retries: 0, headers });
          if (extractItems(data).length) break;
        } catch {
          // try next candidate
        }
      }

      const items = extractItems(data);
      if (items.length) {
        return items.slice(0, limit).map((it) => {
          const id = it?.id ?? it?.modelId ?? it?.model_id ?? it?.objectId ?? null;
          const slug = it?.slug ?? it?.modelSlug ?? it?.seo_slug ?? null;
          const title = it?.name ?? it?.title ?? it?.modelName ?? "Untitled";
          const url = buildPublicUrl(id, slug) ?? searchUrlTemplate.replace("{q}", encodeURIComponent(q));
          const author =
            it?.owner?.username ?? it?.owner?.name ?? it?.user?.name ?? it?.userName ?? it?.author ?? "";
          const likes = Number(it?.likeCount ?? it?.likes ?? 0);
          const downloads = Number(it?.downloadCount ?? it?.downloads ?? 0);
          const views = Number(it?.viewCount ?? it?.views ?? 0);
          const publishedAt = it?.publishedAt ?? it?.createdAt ?? null;

          return {
            source: "makerworld",
            id: String(id ?? slug ?? title),
            title,
            url,
            thumbnail: pickThumb(it),
            author,
            meta: {
              likes,
              downloads,
              views,
              publishedAt,
            },
            score: likes + downloads * 0.5 + views * 0.01,
          };
        });
      }

      const htmlCandidates = [
        `${searchUrlTemplate.replace("{q}", encodeURIComponent(q))}&page=${page}`,
        `https://makerworld.com/en/search?keyword=${encodeURIComponent(q)}&page=${page}`,
      ];

      let captchaDetected = false;
      for (const htmlUrl of htmlCandidates) {
        try {
          const html = await fetchText(htmlUrl, { timeoutMs: 6_000, retries: 0, headers });
          const parsed = parseHtmlFallback(html, limit);
          if (parsed.length) return parsed;
          if (/security verification|captcha|just a moment|cloudflare/i.test(html)) captchaDetected = true;
        } catch {
          // try next candidate
        }

        try {
          const mirror = await fetchText(`https://r.jina.ai/${htmlUrl}`, { timeoutMs: 7_000, retries: 0 });
          const parsed = parseHtmlFallback(mirror, limit);
          if (parsed.length) return parsed;
          if (/requiring CAPTCHA|security verification|just a moment|forbidden/i.test(mirror)) captchaDetected = true;
        } catch {
          // try next candidate
        }
      }

      if (captchaDetected) {
        const blocked = buildFallbackLink(q);
        blocked.title = `MakerWorld verification required — open search for “${q}”`;
        blocked.author = "CAPTCHA / anti-bot challenge";
        blocked.meta = { ...(blocked.meta || {}), tags: [...(blocked.meta?.tags || []), "captcha"] };
        return [blocked];
      }

      return [buildFallbackLink(q)];
    },
  };
}
