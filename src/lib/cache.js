class TinyCache {
  constructor({ ttlMs = 30_000, max = 500 } = {}) {
    this.ttlMs = ttlMs;
    this.max = max;
    this.map = new Map();
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) return null;

    if (entry.expiresAt < Date.now()) {
      this.map.delete(key);
      return null;
    }

    return entry.value;
  }

  set(key, value) {
    if (this.map.size >= this.max) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey) this.map.delete(oldestKey);
    }

    this.map.set(key, {
      value,
      expiresAt: Date.now() + this.ttlMs,
    });
  }
}

export const cache = new TinyCache({
  max: 500,
  ttlMs: 30_000,
});
