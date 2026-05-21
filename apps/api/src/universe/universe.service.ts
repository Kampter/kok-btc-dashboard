import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import type { Pool } from 'pg';
import { DB_POOL } from '../database/persistent-cache.service';

interface UniverseRow {
  token_symbol: string;
  inst_id: string;
  rank: number;
}

@Injectable()
export class UniverseService implements OnModuleInit {
  private readonly logger = new Logger(UniverseService.name);

  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureTables();
  }

  private async ensureTables(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS token_universe (
        id             SERIAL PRIMARY KEY,
        token_symbol   TEXT NOT NULL UNIQUE,
        inst_id        TEXT NOT NULL,
        rank           INTEGER NOT NULL,
        market_cap_usd NUMERIC(20, 2),
        updated_at     TIMESTAMPTZ DEFAULT NOW()
      )
    `);
  }

  async getCurrentUniverse(): Promise<UniverseRow[]> {
    const result = await this.pool.query<UniverseRow>(`
      SELECT token_symbol, inst_id, rank
      FROM token_universe
      ORDER BY rank ASC
    `);
    return result.rows;
  }

  async updateUniverse(items: Array<{ tokenSymbol: string; instId: string; rank: number; marketCapUsd?: number }>): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('TRUNCATE TABLE token_universe');

      for (const item of items) {
        await client.query(
          `INSERT INTO token_universe (token_symbol, inst_id, rank, market_cap_usd)
           VALUES ($1, $2, $3, $4)`,
          [item.tokenSymbol, item.instId, item.rank, item.marketCapUsd ?? null],
        );
      }

      await client.query('COMMIT');
      this.logger.log(`Updated universe with ${items.length} tokens`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
