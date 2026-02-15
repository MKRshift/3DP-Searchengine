function normStr(s) {
  return (s ?? "").toString().trim().toLowerCase();
}

function keyFor(item) {
  // Prefer canonical URL; fall back to source+id+title
  return normStr(item.url) || `${item.source}:${item.id}:${normStr(item.title)}`;
}

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

function dateMs(x) {
  const t = Date.parse(x);
  return Number.isFinite(t) ? t : 0;
}

function sortKey(it, sort) {
  const m = it?.meta ?? {};
  switch ((sort || "relevant").toLowerCase()) {
    case "newest":
      return dateMs(m.publishedAt || m.createdAt || m.updatedAt || m.date);
    case "likes":
      return num(m.likes);
    case "downloads":
      return num(m.downloads || m.download_count || m.collects);
    case "views":
      return num(m.views || m.visits);
    case "relevant":
    case "relevance":
    default:
      return num(it.score);
  }
}

export function rankAndDedupe(items, sort = "relevant") {
  const seen = new Set();
  const out = [];

  // Ranking: selected key desc, then score desc, then title.
  const sorted = [...items].sort((a, b) => {
    const ka = sortKey(a, sort);
    const kb = sortKey(b, sort);
    return (kb - ka) || (num(b.score) - num(a.score)) || (a.title ?? "").localeCompare(b.title ?? "");
  });

  for (const it of sorted) {
    const k = keyFor(it);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}
