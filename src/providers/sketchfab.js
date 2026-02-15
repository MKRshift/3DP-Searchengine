import { fetchJson } from "../lib/http.js";

function pickBestThumb(model) {
  const imgs = model?.thumbnails?.images;
  if (!Array.isArray(imgs) || imgs.length === 0) return null;
  // pick highest width
  let best = imgs[0];
  for (const im of imgs) if ((im?.width ?? 0) > (best?.width ?? 0)) best = im;
  return best?.url ?? null;
}

export function sketchfabProvider() {
  const token = process.env.SKETCHFAB_TOKEN?.trim();

  return {
    id: "sketchfab",
    label: "Sketchfab",
    kind: "api",
    homepage: "https://sketchfab.com",
    iconUrl: "https://www.google.com/s2/favicons?domain=sketchfab.com&sz=64",
    searchUrlTemplate: "https://sketchfab.com/search?q={q}&type=models",
    isPublic: true,
    notes: token ? "token set ✅" : "public search ✅ (token optional)",
    isConfigured() {
      // public search works without token
      return true;
    },
    async search({ q, limit, page }) {
      const perPage = Math.min(limit, 24);
      const headers = token ? { Authorization: `Token ${token}` } : {};

      // Sketchfab uses cursor pagination, not page numbers.
      let url = new URL("https://api.sketchfab.com/v3/search");
      url.searchParams.set("type", "models");
      url.searchParams.set("q", q);
      url.searchParams.set("per_page", String(perPage));

      let data = await fetchJson(url.toString(), { headers });

      // walk "next" link if page > 1
      let steps = Math.min(page - 1, 3);
      while (steps > 0 && data?.next) {
        data = await fetchJson(data.next, { headers });
        steps--;
      }

      const results = Array.isArray(data?.results) ? data.results : [];
      return results.slice(0, limit).map((m) => {
        const id = m?.uid ?? m?.id ?? "";
        const title = m?.name ?? "Untitled";
        const author = m?.user?.displayName ?? m?.user?.username ?? "";
        const urlPublic =
          m?.viewerUrl ||
          m?.url ||
          (id ? `https://sketchfab.com/models/${id}` : null);

        const likes = Number(m?.likeCount ?? 0);
        const views = Number(m?.viewCount ?? 0);
        const publishedAt = m?.publishedAt ?? m?.createdAt ?? m?.published_at ?? null;

        return {
          source: "sketchfab",
          id: String(id),
          title,
          url: urlPublic,
          thumbnail: pickBestThumb(m),
          author,
          meta: {
            likes,
            views,
            downloadable: m?.isDownloadable ?? null,
            license: m?.license ?? null,
            publishedAt,
          },
          score: likes + views * 0.01,
        };
      });
    },
  };
}
