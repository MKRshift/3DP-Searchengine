function normStr(value) {
  return (value ?? "").toString().trim().toLowerCase();
}

function resultKey(item) {
  return normStr(item.url) || `${item.source}:${item.id}:${normStr(item.title)}`;
}

function canonicalKey(item) {
  const title = normStr(item.title).replace(/[^a-z0-9]+/g, " ").trim();
  const creator = normStr(item.creatorName || item.author).replace(/[^a-z0-9]+/g, " ").trim();
  if (!title) return resultKey(item);
  return `${title}::${creator}`;
}

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function dateMs(value) {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function daysAgo(value) {
  const ms = dateMs(value);
  if (!ms) return 3650;
  return Math.max(0, (Date.now() - ms) / 86_400_000);
}

function normalizedPopularity(item) {
  const stats = item?.stats ?? {};
  const meta = item?.meta ?? {};
  const likes = numeric(stats.likes ?? meta.likes);
  const downloads = numeric(stats.downloads ?? meta.downloads ?? meta.download_count ?? meta.collects);
  const views = numeric(stats.views ?? meta.views ?? meta.visits);
  return likes * 1.3 + downloads * 1.1 + views * 0.08;
}

function trendingScore(item) {
  const freshness = 1 / (1 + daysAgo(item.publishedAt || item.updatedAt || item?.meta?.publishedAt || item?.meta?.createdAt));
  return normalizedPopularity(item) * 0.7 + freshness * 100;
}

function boostsScore(item) {
  const boosted = item?.meta?.boosted ? 100 : 0;
  return trendingScore(item) + boosted;
}

function sortKey(item, sort) {
  switch ((sort || "relevant").toLowerCase()) {
    case "newest":
      return dateMs(item.publishedAt || item.updatedAt || item?.meta?.publishedAt || item?.meta?.createdAt || item?.meta?.updatedAt);
    case "likes":
      return numeric(item?.stats?.likes ?? item?.meta?.likes);
    case "downloads":
      return numeric(item?.stats?.downloads ?? item?.meta?.downloads ?? item?.meta?.download_count ?? item?.meta?.collects);
    case "views":
      return numeric(item?.stats?.views ?? item?.meta?.views ?? item?.meta?.visits);
    case "trending":
      return trendingScore(item);
    case "boosts":
      return boostsScore(item);
    case "relevant":
    case "relevance":
    default:
      return numeric(item.score);
  }
}

export function rankAndDedupe(items, sort = "relevant") {
  const sorted = [...items].sort((a, b) => {
    const bySort = sortKey(b, sort) - sortKey(a, sort);
    if (bySort) return bySort;

    const byScore = numeric(b.score) - numeric(a.score);
    if (byScore) return byScore;

    return (a.title ?? "").localeCompare(b.title ?? "");
  });

  const exactSeen = new Set();
  const merged = new Map();

  for (const item of sorted) {
    const exactKey = resultKey(item);
    if (exactSeen.has(exactKey)) continue;
    exactSeen.add(exactKey);

    const key = canonicalKey(item);
    const current = merged.get(key);
    if (!current) {
      merged.set(key, {
        ...item,
        alsoFoundOn: [item.source],
        sourceVariants: [{ source: item.source, url: item.url }],
      });
      continue;
    }

    const best = {
      ...current,
      thumbnail: current.thumbnail || item.thumbnail,
      creatorName: current.creatorName || item.creatorName,
      license: current.license || item.license,
      formats: (current.formats?.length ? current.formats : item.formats) || [],
      stats: {
        likes: Math.max(numeric(current?.stats?.likes), numeric(item?.stats?.likes)) || undefined,
        downloads:
          Math.max(numeric(current?.stats?.downloads), numeric(item?.stats?.downloads ?? item?.meta?.downloads)) || undefined,
        views: Math.max(numeric(current?.stats?.views), numeric(item?.stats?.views)) || undefined,
      },
      alsoFoundOn: [...new Set([...(current.alsoFoundOn || []), item.source])],
      sourceVariants: [...(current.sourceVariants || []), { source: item.source, url: item.url }],
    };
    merged.set(key, best);
  }

  return [...merged.values()];
}
