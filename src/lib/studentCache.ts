/**
 * High-performance, zero-dependency caching layer specifically engineered to optimize Firestore reads
 * and eliminate redundant query overhead in student-facing flows.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class StudentCache {
  private memoryCache = new Map<string, CacheEntry<any>>();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes standard TTL

  /**
   * Constructs a highly unique cache key based on query parameters.
   */
  public generateKey(prefix: string, ...args: any[]): string {
    return `${prefix}:${args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(':')}`;
  }

  /**
   * Retrieves a cached item if it exists and hasn't expired.
   */
  public get<T>(key: string, customTTLMs?: number): T | null {
    const entry = this.memoryCache.get(key);
    if (!entry) return null;

    const ttl = customTTLMs !== undefined ? customTTLMs : this.defaultTTL;
    const isExpired = Date.now() - entry.timestamp > ttl;

    if (isExpired) {
      this.memoryCache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Writes data into the memory cache.
   */
  public set<T>(key: string, data: T): void {
    this.memoryCache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Explicitly evicts a single cache entry.
   */
  public invalidate(key: string): void {
    this.memoryCache.delete(key);
  }

  /**
   * Evicts all cache entries matching a prefix pattern (e.g. 'quizzes').
   */
  public invalidatePrefix(prefix: string): void {
    const prefixStr = prefix + ':';
    for (const key of this.memoryCache.keys()) {
      if (key.startsWith(prefixStr)) {
        this.memoryCache.delete(key);
      }
    }
  }

  /**
   * Invalidates all student-focused cache prefixes at once (useful after quiz submission).
   */
  public invalidateStudentCache(): void {
    this.invalidatePrefix('quizzes-list');
    this.invalidatePrefix('submissions-list');
    this.invalidatePrefix('quiz-rankings');
    this.invalidatePrefix('global-rankings');
    this.invalidatePrefix('top-achievers-quizzes');
  }

  /**
   * Clears the entire cache store.
   */
  public clear(): void {
    this.memoryCache.clear();
  }
}

export const studentCache = new StudentCache();
