import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common'
import type { Pool } from 'pg'

export const DB_POOL = Symbol('DB_POOL')

@Injectable()
export class PersistentCacheService implements OnModuleInit {
  private readonly logger = new Logger(PersistentCacheService.name)

  constructor(@Inject(DB_POOL) private readonly pool: Pool) {}

  async onModuleInit(): Promise<void> {
    await this.ensureTable()
    await this.cleanupExpired()
  }

  private async ensureTable(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS cache_entries (
        cache_key   TEXT PRIMARY KEY,
        value       JSONB NOT NULL,
        expires_at  TIMESTAMP WITH TIME ZONE,
        created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `)
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_cache_entries_expires_at
      ON cache_entries(expires_at)
    `)
  }

  async get<T>(key: string, options?: { includeExpired?: boolean }): Promise<T | null> {
    const includeExpired = options?.includeExpired ?? false

    const query = includeExpired
      ? 'SELECT value FROM cache_entries WHERE cache_key = $1'
      : 'SELECT value FROM cache_entries WHERE cache_key = $1 AND (expires_at IS NULL OR expires_at > NOW())'

    const result = await this.pool.query(query, [key])
    if (result.rows.length === 0) return null
    return result.rows[0].value as T
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlMs)
    await this.pool.query(
      `INSERT INTO cache_entries (cache_key, value, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (cache_key) DO UPDATE SET
         value = EXCLUDED.value,
         expires_at = EXCLUDED.expires_at,
         created_at = NOW()`,
      [key, JSON.stringify(value), expiresAt],
    )
  }

  async cleanupExpired(): Promise<void> {
    const result = await this.pool.query(
      'DELETE FROM cache_entries WHERE expires_at IS NOT NULL AND expires_at <= NOW()',
    )
    if (result.rowCount && result.rowCount > 0) {
      this.logger.log(`Cleaned up ${result.rowCount} expired cache entries`)
    }
  }
}
