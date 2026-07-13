import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface RedisCommandClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, mode?: 'EX', seconds?: number, condition?: 'NX'): Promise<'OK' | null>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
}

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;
  private readonly commands: RedisCommandClient;

  constructor(config: ConfigService) {
    this.client = new Redis(config.get<string>('REDIS_URL') ?? 'redis://127.0.0.1:6379', {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    this.commands = new ResilientRedisClient(this.client, config.get<string>('NODE_ENV') === 'production');
  }

  async getClient(): Promise<RedisCommandClient> { return this.commands; }

  async onModuleDestroy() { this.client.disconnect(); }
}

class ResilientRedisClient implements RedisCommandClient {
  private readonly fallback = new DevelopmentMemoryRedis();
  private readonly logger = new Logger(RedisService.name);
  private warned = false;

  constructor(private readonly redis: Redis, private readonly production: boolean) {}

  get(key: string) { return this.run((client) => client.get(key), (memory) => memory.get(key)); }
  set(key: string, value: string, mode?: 'EX', seconds?: number, condition?: 'NX') {
    return this.run(
      (client) => mode === 'EX' && seconds != null
        ? condition === 'NX' ? client.set(key, value, 'EX', seconds, 'NX') : client.set(key, value, 'EX', seconds)
        : client.set(key, value),
      (memory) => memory.set(key, value, mode, seconds, condition),
    );
  }
  incr(key: string) { return this.run((client) => client.incr(key), (memory) => memory.incr(key)); }
  expire(key: string, seconds: number) { return this.run((client) => client.expire(key, seconds), (memory) => memory.expire(key, seconds)); }

  private async run<T>(remote: (client: Redis) => Promise<T>, local: (memory: DevelopmentMemoryRedis) => Promise<T>) {
    try {
      if (this.redis.status === 'wait') await this.redis.connect();
      return await remote(this.redis);
    } catch (error) {
      if (this.production) throw error;
      if (!this.warned) {
        this.warned = true;
        this.logger.warn('Redis unavailable; using process-local development fallback');
      }
      return local(this.fallback);
    }
  }
}

export class DevelopmentMemoryRedis implements RedisCommandClient {
  private readonly values = new Map<string, { value: string; expiresAt: number | null }>();

  async get(key: string) { return this.current(key)?.value ?? null; }

  async set(key: string, value: string, mode?: 'EX', seconds?: number, condition?: 'NX'): Promise<'OK' | null> {
    if (condition === 'NX' && this.current(key)) return null;
    this.values.set(key, { value, expiresAt: mode === 'EX' && seconds != null ? Date.now() + seconds * 1000 : null });
    return 'OK';
  }

  async incr(key: string) {
    const current = this.current(key);
    const value = Number(current?.value ?? 0) + 1;
    this.values.set(key, { value: String(value), expiresAt: current?.expiresAt ?? null });
    return value;
  }

  async expire(key: string, seconds: number) {
    const current = this.current(key);
    if (!current) return 0;
    this.values.set(key, { value: current.value, expiresAt: Date.now() + seconds * 1000 });
    return 1;
  }

  private current(key: string) {
    const value = this.values.get(key);
    if (value?.expiresAt != null && value.expiresAt <= Date.now()) {
      this.values.delete(key);
      return null;
    }
    return value ?? null;
  }
}
