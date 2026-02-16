import { compactNumber, esc } from "../../lib/format.js";

const SOURCE_ICON_MAP = {
  sketchfab: "https://www.google.com/s2/favicons?domain=sketchfab.com&sz=64",
  mmf: "https://www.google.com/s2/favicons?domain=myminifactory.com&sz=64",
  cgtrader: "https://www.google.com/s2/favicons?domain=cgtrader.com&sz=64",
  cults: "https://www.google.com/s2/favicons?domain=cults3d.com&sz=64",
  thingiverse: "https://www.google.com/s2/favicons?domain=thingiverse.com&sz=64",
  nasa: "https://www.google.com/s2/favicons?domain=nasa.gov&sz=64",
  smithsonian: "https://www.google.com/s2/favicons?domain=si.edu&sz=64",
  printables: "https://www.google.com/s2/favicons?domain=printables.com&sz=64",
  thangs: "https://www.google.com/s2/favicons?domain=thangs.com&sz=64",
  makerworld: "https://www.google.com/s2/favicons?domain=makerworld.com&sz=64",
  turbosquid: "https://www.google.com/s2/favicons?domain=turbosquid.com&sz=64",
  openbuilds: "https://www.google.com/s2/favicons?domain=openbuilds.com&sz=64",
  vectric: "https://www.google.com/s2/favicons?domain=vectric.com&sz=64",
  easel: "https://www.google.com/s2/favicons?domain=easel.com&sz=64",
  glowforge: "https://www.google.com/s2/favicons?domain=glowforge.com&sz=64",
  xtool: "https://www.google.com/s2/favicons?domain=xtool.com&sz=64",
};

function resolveSourceIcon(item) {
  if (item.sourceIconUrl) return item.sourceIconUrl;
  if (!item.source) return "";
  return SOURCE_ICON_MAP[item.source] || "";
}

function stat(label, value) {
  const n = compactNumber(value);
  if (!n) return "";
  return `<span>${esc(label)} ${esc(n)}</span>`;
}

function qualityLine(item) {
  const stats = item.stats || item.meta || {};
  const pieces = [
    stat("Likes", stats.likes),
    stat("Downloads", stats.downloads ?? stats.download_count ?? stats.collects),
    stat("Views", stats.views ?? stats.visits),
    item.license ? `<span>${esc(item.license)}</span>` : "",
    Array.isArray(item.formats) && item.formats.length ? `<span>${esc(item.formats.slice(0, 3).join("/"))}</span>` : "",
  ].filter(Boolean);

  return pieces.length ? pieces.join(" • ") : "<span>No rich metadata</span>";
}

function previewPayload(item) {
  return esc(JSON.stringify({
    id: item.id,
    title: item.title,
    url: item.url,
    thumbnail: item.thumbnail,
    creatorName: item.creatorName || item.author,
    source: item.source,
    sourceLabel: item.sourceLabel,
    sourceIconUrl: item.sourceIconUrl,
    assetType: item.assetType,
    license: item.license,
    stats: item.stats || item.meta || {},
  }));
}

function sourceVariants(item) {
  if (!Array.isArray(item.alsoFoundOn) || item.alsoFoundOn.length < 2) return "";
  const extras = item.alsoFoundOn.slice(1, 5).map((source) => `<span class="card__variant">${esc(source)}</span>`).join("");
  return `<div class="card__variants">Also on ${extras}</div>`;
}

function buildCard(item) {
  const payload = previewPayload(item);
  const thumbStyle = item.thumbnail ? `background-image:url('${esc(item.thumbnail)}')` : "";

  const iconUrl = resolveSourceIcon(item);
  const icon = iconUrl
    ? `<div class="card__source-icon"><img src="${esc(iconUrl)}" alt="" loading="lazy" /></div>`
    : "";

  return `<article class="card" data-preview-item="${payload}"><a class="card__link" href="${esc(item.url || "#")}" target="_blank" rel="noopener noreferrer"><div class="card__thumb" style="${thumbStyle}">${icon}<div class="card__actions"><button class="card__action" data-action="open" data-url="${esc(item.url || "")}">Open</button></div></div></a><div class="card__body"><h3 class="card__title">${esc(item.title || "Untitled")}</h3><div class="card__meta"><span>${esc(item.creatorName || item.author || "Unknown")}</span><span class="card__source-toggle">${esc(item.sourceLabel || item.source || "source")}</span></div><div class="card__stats">${qualityLine(item)}</div></div></article>`;
}

export function renderResultGrid(root, items, { append = false } = {}) {
  if (!items?.length && !append) {
    root.innerHTML = `<div class="empty">No results found. Try broader keywords, switch category, or clear source filters.<div style="margin-top:8px;display:flex;gap:6px;justify-content:center;flex-wrap:wrap"><span class="query-chip">Try: bracket</span><span class="query-chip">Try: organizer</span><span class="query-chip">Try: lamp</span></div></div>`;
    return;
  }

  const html = items.map(buildCard).join("");
  if (append) root.insertAdjacentHTML("beforeend", html);
  else root.innerHTML = html;
}

export function renderSkeleton(root, count = 12) {
  root.innerHTML = Array.from({ length: count }).map(() => `<article class="card"><div class="card__thumb"></div><div class="card__body"><h3 class="card__title">Loading…</h3><div class="card__meta">Please wait</div></div></article>`).join("");
}
