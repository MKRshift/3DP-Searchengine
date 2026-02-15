export function buildSearchUrl(template, query) {
  if (!template) return null;
  return template.replaceAll("{q}", encodeURIComponent(query ?? ""));
}
