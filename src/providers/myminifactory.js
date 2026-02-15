import { fetchJson } from "../lib/http.js";

function first(arr) {
  return Array.isArray(arr) && arr.length ? arr[0] : null;
}

function pickImage(item) {
  // MMF responses vary by endpoint / permissions. Be defensive.
  const candidates = [
    item?.cover?.url,
    item?.cover_url,
    item?.image,
    item?.image_url,
    first(item?.images)?.url,
    first(item?.images),
  ].filter(Boolean);

  return candidates[0] ?? null;
}

export function myMiniFactoryProvider() {
  const apiKey = process.env.MMF_API_KEY?.trim();

  return {
    id: "mmf",
    label: "MyMiniFactory",
    kind: "api",
    homepage: "https://www.myminifactory.com",
    iconUrl: "https://www.google.com/s2/favicons?domain=myminifactory.com&sz=64",
    searchUrlTemplate: "https://www.myminifactory.com/search/?query={q}",
    isPublic: false,
    notes: apiKey ? "api key set ✅" : "needs MMF_API_KEY ⚠️",
    isConfigured() {
      return Boolean(apiKey);
    },
    async search({ q, limit, page }) {
      if (!apiKey) throw new Error("MMF_API_KEY not set");

      const url = new URL("https://www.myminifactory.com/api/v2/search");
      url.searchParams.set("q", q);
      url.searchParams.set("page", String(page));
      url.searchParams.set("per_page", String(Math.min(limit, 30)));
      url.searchParams.set("key", apiKey); // per MyMiniFactory OpenAPI "ApiKeyAuth" (query param: key)

      const data = await fetchJson(url.toString());
      const items = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];

      return items.slice(0, limit).map((it) => {
        const id = it?.id ?? it?.object_id ?? it?.uid ?? it?.slug ?? "";
        const title = it?.name ?? it?.title ?? it?.slug ?? "Untitled";
        const urlPublic = it?.url ?? it?.public_url ?? null;
        const author = it?.owner?.username ?? it?.owner?.name ?? it?.creator?.name ?? "";

        const visits = Number(it?.visits ?? it?.view_count ?? 0);
        const likes = Number(it?.likes ?? it?.like_count ?? 0);

        return {
          source: "mmf",
          id: String(id),
          title,
          url: urlPublic,
          thumbnail: pickImage(it),
          author,
          meta: {
            likes,
            visits,
            support_free: it?.support_free ?? null,
            store_license: it?.store ?? null,
          },
          score: likes + visits * 0.01,
        };
      });
    },
  };
}
