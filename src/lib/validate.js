export function safeNumber(value, fallback, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const i = Math.floor(n);
  if (i < min) return min;
  if (i > max) return max;
  return i;
}

export function parseCsv(s) {
  return s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}
