type CacheEntry<T> = {
  data: T;
  expiresAt: number;
};

class ServerCache {
  private store = new Map<string, CacheEntry<any>>();

  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlSeconds: number): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  invalidatePattern(pattern: string): void {
    Array.from(this.store.keys()).forEach((key) => {
      if (key.includes(pattern)) {
        this.store.delete(key);
      }
    });
  }

  clear(): void {
    this.store.clear();
  }
}

export const serverCache = new ServerCache();
