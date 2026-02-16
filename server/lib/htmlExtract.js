export function safeDecode(value) {
  try {
    return decodeURIComponent(String(value || ""));
  } catch {
    return String(value || "");
  }
}

export function toAbsoluteUrl(url, origin) {
  if (!url) return null;
  const raw = String(url).trim();
  if (!raw) return null;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  if (raw.startsWith("/") && origin) return `${origin}${raw}`;
  return null;
}

export function pickImageFromSnippet(snippet, origin) {
  if (!snippet) return null;

  const metaMatch = snippet.match(/<meta[^>]+(?:property|name)="(?:og:image|twitter:image)"[^>]+content="([^"]+)"/i);
  if (metaMatch?.[1]) {
    const absolute = toAbsoluteUrl(metaMatch[1], origin);
    if (absolute) return absolute;
  }

  const srcsetMatch = snippet.match(/<img[^>]+srcset="([^"]+)"/i);
  if (srcsetMatch?.[1]) {
    const srcsetUrl = srcsetMatch[1]
      .split(",")
      .map((part) => part.trim().split(/\s+/)[0])
      .filter(Boolean)
      .pop();
    const absolute = toAbsoluteUrl(srcsetUrl, origin);
    if (absolute) return absolute;
  }

  const srcMatch = snippet.match(/<img[^>]+(?:src|data-src|data-original)="([^"]+)"/i);
  if (srcMatch?.[1]) {
    const absolute = toAbsoluteUrl(srcMatch[1], origin);
    if (absolute) return absolute;
  }

  return null;
}

export function titleFromPath(path, fallback = "Untitled") {
  const slug = String(path || "").split("/").pop() || "";
  const decoded = safeDecode(slug).replace(/^\d+-/, "").replace(/[-_]+/g, " ").trim();
  return decoded || fallback;
}
