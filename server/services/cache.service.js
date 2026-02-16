const MAX = 500;
const TTL = 30_000;

function prunableMap() {
  const map = new Map();
  function prune() {
    if (map.size <= MAX) return;
    const first = map.keys().next().value;
    if (first !== undefined) map.delete(first);
  }
  return {
    get(key) {
      const entry = map.get(key);
      if (!entry) return undefined;
      if (Date.now() - entry.t > TTL) {
        map.delete(key);
        return undefined;
      }
      return entry.v;
    },
    set(key, value) {
      map.set(key, { v: value, t: Date.now() });
      prune();
    },
  };
}

export const cache = prunableMap();
