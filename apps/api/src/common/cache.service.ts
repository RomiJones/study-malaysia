import { Injectable, OnModuleDestroy } from "@nestjs/common";
import IORedis, { Redis } from "ioredis";

@Injectable()
export class CacheService implements OnModuleDestroy {
  private client?: Redis;

  constructor() {
    const url = process.env.REDIS_URL;
    if (url) {
      const RedisCtor = IORedis as unknown as new (connection: string, options: Record<string, unknown>) => Redis;
      this.client = new RedisCtor(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
      this.client.on("error", () => {
        this.client = undefined;
      });
      void this.client.connect().catch(() => {
        this.client = undefined;
      });
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    if (!this.client) return null;
    try {
      const value = await this.client.get(key);
      return value ? (JSON.parse(value) as T) : null;
    } catch {
      this.client = undefined;
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds = 300) {
    if (!this.client) return;
    try {
      await this.client.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch {
      this.client = undefined;
    }
  }

  async del(key: string) {
    if (!this.client) return;
    try {
      await this.client.del(key);
    } catch {
      this.client = undefined;
    }
  }

  async clearByPrefix(prefix: string) {
    if (!this.client) return;
    try {
      let cursor = "0";
      do {
        const [nextCursor, keys] = await this.client.scan(cursor, "MATCH", `${prefix}*`, "COUNT", 100);
        cursor = nextCursor;
        if (keys.length) {
          await this.client.del(...keys);
        }
      } while (cursor !== "0");
    } catch {
      this.client = undefined;
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit().catch(() => undefined);
    }
  }
}
