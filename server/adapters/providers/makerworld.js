import { fetchJson } from "../../lib/http.js";

function pickThumb(it) {
  const candidates = [
    it?.coverUrl,
    it?.cover_url,
    it?.imageUrl,
    it?.image_url,
    it?.image,
    it?.thumb,
  ].filter(Boolean);
  return candidates[0] ?? null;
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
      : "public JSON search endpoint (auto-discovered); falls back to link if unavailable",
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
          // alternate param names some deployments use
          `https://makerworld.com/api/v1/search?keyword=${encodeURIComponent(q)}&scene=models&orderBy=${encodeURIComponent(orderBy)}&p=${page}&pageSize=${perPage}`
        );
      }

      let data = null;
      for (const url of candidates) {
        try {
          data = await fetchJson(url, { timeoutMs: 12_000, headers });
          if (extractItems(data).length) break;
        } catch {
          // try next candidate
        }
      }

      const items = extractItems(data);
      if (!items.length) return [];

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
    },
  };
}
