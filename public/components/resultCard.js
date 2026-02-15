import { compactNumber, esc } from "../utils/format.js";

function stat(label, value) {
  const n = compactNumber(value);
  if (!n) return "";
  return `<span>${esc(label)} ${esc(n)}</span>`;
}

function qualityLine(item) {
  const stats = item.stats || item.meta || {};
  const pieces = [
    stat("❤️", stats.likes),
    stat("⬇️", stats.downloads ?? stats.download_count ?? stats.collects),
    stat("👁", stats.views ?? stats.visits),
    item.license ? `<span>${esc(item.license)}</span>` : "",
    Array.isArray(item.formats) && item.formats.length ? `<span>${esc(item.formats.slice(0, 3).join("/"))}</span>` : "",
  ].filter(Boolean);

  return pieces.length ? pieces.join(" • ") : "<span style='color:#667085'>No rich metadata</span>";
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
  const description = item.description || item.meta?.description || item.meta?.summary || "";
  const payload = previewPayload(item);

  return `
    <article class="card" data-preview-item="${payload}">
      <a class="card__link" href="${esc(item.url || "#")}" target="_blank" rel="noopener noreferrer">
        <div class="card__thumb" style="${item.thumbnail ? `background-image:url('${esc(item.thumbnail)}')` : ""}">
          ${item.sourceIconUrl ? `<div class='card__icon'><img src='${esc(item.sourceIconUrl)}' alt='' loading='lazy' /></div>` : ""}
          <div class="card__actions">
            <button class="card__action" data-action="open" data-url="${esc(item.url || "")}">Open</button>
            <button class="card__action" data-action="copy" data-url="${esc(item.url || "")}">Copy</button>
            <button class="card__action" data-action="save" data-url="${esc(item.url || "")}" data-title="${esc(item.title || "Untitled")}" data-source="${esc(item.sourceLabel || item.source || "")}">Save</button>
          </div>
        </div>
      </a>
      <div class="card__body">
        <h3 class="card__title">${esc(item.title || "Untitled")}</h3>
        <div class="card__meta">
          <span>${esc(item.creatorName || item.author || "")}</span>
          <span>${esc(item.sourceLabel || item.source || "")}</span>
        </div>
        ${description ? `<div class='card__meta' style='margin-top:6px;display:block'>${esc(description).slice(0, 96)}</div>` : ""}
        <div class="card__stats">${qualityLine(item)}</div>
        ${sourceVariants(item)}
      </div>
    </article>
  `;
}

export function renderResultGrid(root, items, { append = false } = {}) {
  if (!items?.length && !append) {
    root.innerHTML = `<div class="empty">No results yet. Try another keyword.</div>`;
    return;
  }

  const html = items.map(buildCard).join("");
  if (append) root.insertAdjacentHTML("beforeend", html);
  else root.innerHTML = html;
}

export function renderSkeleton(root, count = 12) {
  root.innerHTML = Array.from({ length: count }).map(() => `
    <article class="card">
      <div class="card__thumb"></div>
      <div class="card__body">
        <h3 class="card__title">Loading…</h3>
        <div class="card__meta">Please wait</div>
      </div>
    </article>
  `).join("");
}
