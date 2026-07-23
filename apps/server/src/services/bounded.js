/**
 * Bounded LRU-style cache used by SSE result delivery.
 * Prevents unbounded memory growth from many unique keys.
 */
export class BoundedCache {
  constructor({ maxEntries = 2000, ttlMs = 60_000 } = {}) {
    this.maxEntries = maxEntries;
    this.ttlMs = ttlMs;
    this.map = new Map();
    this.timers = new Map();
  }

  set(key, value) {
    if (this.map.has(key)) {
      this.map.delete(key);
    }
    this.map.set(key, { value, insertedAt: Date.now() });

    // Evict oldest if over capacity
    if (this.map.size > this.maxEntries) {
      const oldestKey = this.map.keys().next().value;
      this._evict(oldestKey);
    }

    // Schedule TTL eviction
    const existingTimer = this.timers.get(key);
    if (existingTimer) clearTimeout(existingTimer);
    const timer = setTimeout(() => this._evict(key), this.ttlMs);
    timer.unref?.();
    this.timers.set(key, timer);
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    return entry.value;
  }

  delete(key) {
    this._evict(key);
  }

  has(key) {
    return this.map.has(key);
  }

  clear() {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.map.clear();
  }

  get size() {
    return this.map.size;
  }

  _evict(key) {
    const timer = this.timers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(key);
    }
    this.map.delete(key);
  }
}

/**
 * Per-key in-memory rate limiter with periodic sweep to prevent unbounded
 * memory growth from many unique identifiers (e.g. SSR/Redis migration target).
 */
export class KeyedRateLimiter {
  constructor({ limit, windowMs, maxEntries = 5000, sweepIntervalMs = 60_000 }) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.maxEntries = maxEntries;
    this.sweepIntervalMs = sweepIntervalMs;
    this.map = new Map();
    this._sweepTimer = setInterval(() => this._sweep(), this.sweepIntervalMs);
    this._sweepTimer.unref?.();
  }

  hit(key, now = Date.now()) {
    const entry = this.map.get(key);
    if (!entry || now > entry.resetAt) {
      this.map.set(key, { count: 1, resetAt: now + this.windowMs });
      this._evictIfOverCapacity();
      return { allowed: true, remaining: this.limit - 1, resetAt: now + this.windowMs };
    }
    if (entry.count >= this.limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: entry.resetAt,
        retryAfterMs: entry.resetAt - now,
      };
    }
    entry.count++;
    return {
      allowed: true,
      remaining: this.limit - entry.count,
      resetAt: entry.resetAt,
    };
  }

  has(key) {
    return this.map.has(key);
  }

  size() {
    return this.map.size;
  }

  stop() {
    if (this._sweepTimer) clearInterval(this._sweepTimer);
  }

  _evictIfOverCapacity() {
    if (this.map.size <= this.maxEntries) return;
    // Drop oldest entries (Map iteration is insertion-ordered)
    const overflow = this.map.size - this.maxEntries;
    let i = 0;
    for (const key of this.map.keys()) {
      if (i >= overflow) break;
      this.map.delete(key);
      i++;
    }
  }

  _sweep(now = Date.now()) {
    for (const [key, entry] of this.map.entries()) {
      if (now > entry.resetAt) this.map.delete(key);
    }
  }
}
