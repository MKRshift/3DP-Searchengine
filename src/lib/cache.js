import { LRUCache } from "lru-cache";

// Tiny in-memory cache: avoids hammering APIs when you type fast.
// If you deploy, consider Redis + per-user cache keys.
export const cache = new LRUCache({
  max: 500,
  ttl: 30_000, // 30s
});
