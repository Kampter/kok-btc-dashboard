import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import type { Pool } from 'pg';
import { parseInstrumentName } from '@kok/shared-types';
import { DB_POOL } from '../database/persistent-cache.service';

const CONTRACT_MULTIPLIER = 1;

interface BookSummaryItem {
  instrument_name: string;
  open_interest: number;
  volume_usd: number;
  underlying_price: number;
  mark_iv: number;
  bid_iv: number;
  ask_iv: number;
}

interface IndexPriceData {
  index_price: number;
}

@Injectable()
export class SnapshotService implements OnModuleInit {
  private readonly logger = new Logger(SnapshotService.name);

  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureTables();
  }

  private async ensureTables(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS market_snapshots (
        id            SERIAL PRIMARY KEY,
        snapshot_at   TIMESTAMPTZ NOT NULL UNIQUE,
        btc_price     NUMERIC(16,2),
        total_oi_usd  NUMERIC(20,2),
        total_volume_24h_usd NUMERIC(20,2),
        atm_iv        NUMERIC(8,4),
        pc_ratio      NUMERIC(6,4),
        created_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_market_snapshots_time
      ON market_snapshots(snapshot_at)
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS contract_snapshots (
        id              SERIAL PRIMARY KEY,
        snapshot_id     INTEGER NOT NULL REFERENCES market_snapshots(id) ON DELETE CASCADE,
        instrument_name TEXT NOT NULL,
        strike          NUMERIC(16,2) NOT NULL,
        expiry          TIMESTAMPTZ NOT NULL,
        option_type     CHAR(1) NOT NULL CHECK (option_type IN ('C', 'P')),
        open_interest   NUMERIC(20,2),
        open_interest_usd NUMERIC(20,2),
        mark_iv         NUMERIC(8,4),
        bid_iv          NUMERIC(8,4),
        ask_iv          NUMERIC(8,4),
        underlying_price NUMERIC(16,2),
        volume_24h      NUMERIC(20,2),
        created_at      TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_contract_snapshots_snapshot
      ON contract_snapshots(snapshot_id)
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_contract_snapshots_instrument
      ON contract_snapshots(instrument_name)
    `);
  }

  async collectSnapshot(): Promise<void> {
    const bookData = await this.cacheManager.get<BookSummaryItem[]>('book_summary_BTC_option');
    const indexData = await this.cacheManager.get<IndexPriceData>('index_price_btc_usd');

    if (!bookData || !indexData) {
      this.logger.warn('Memory cache empty, skipping snapshot collection');
      return;
    }

    const btcPrice = indexData.index_price ?? 0;

    // Calculate market aggregates
    let totalOiUsd = 0;
    let totalVolume24hUsd = 0;
    let callOiUsd = 0;
    let putOiUsd = 0;
    const atmIVs: number[] = [];

    for (const item of bookData) {
      const oi = (item.open_interest as number) ?? 0;
      const underlyingPrice = (item.underlying_price as number) ?? btcPrice;
      const oiUsd = oi * underlyingPrice * CONTRACT_MULTIPLIER;
      const volume = (item.volume_usd as number) ?? 0;

      totalOiUsd += oiUsd;
      totalVolume24hUsd += volume;

      try {
        const parsed = parseInstrumentName(item.instrument_name);
        if (parsed.optionType === 'C') {
          callOiUsd += oiUsd;
        } else {
          putOiUsd += oiUsd;
        }

        const iv = (item.mark_iv as number) ?? 0;
        if (parsed.strike >= btcPrice * 0.98 && parsed.strike <= btcPrice * 1.02 && iv > 0) {
          atmIVs.push(iv);
        }
      } catch {
        // Skip instruments that fail parsing
      }
    }

    const atmIV = atmIVs.length > 0
      ? atmIVs.reduce((sum, iv) => sum + iv, 0) / atmIVs.length
      : 0;

    const pcRatio = (putOiUsd + callOiUsd) > 0
      ? putOiUsd / (putOiUsd + callOiUsd)
      : 0;

    // Insert market snapshot
    const snapshotAt = new Date();
    snapshotAt.setSeconds(0, 0); // Truncate to minute

    const marketResult = await this.pool.query(
      `INSERT INTO market_snapshots (snapshot_at, btc_price, total_oi_usd, total_volume_24h_usd, atm_iv, pc_ratio)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (snapshot_at) DO NOTHING
       RETURNING id`,
      [snapshotAt, btcPrice, totalOiUsd, totalVolume24hUsd, atmIV, pcRatio],
    );

    if (marketResult.rows.length === 0) {
      this.logger.warn(`Snapshot already exists for ${snapshotAt.toISOString()}, skipping`);
      return;
    }

    const snapshotId = marketResult.rows[0].id;

    // Batch insert contract snapshots
    const contractValues: unknown[] = [];
    for (const item of bookData) {
      try {
        const parsed = parseInstrumentName(item.instrument_name);
        const oi = (item.open_interest as number) ?? 0;
        const underlyingPrice = (item.underlying_price as number) ?? btcPrice;
        const oiUsd = oi * underlyingPrice * CONTRACT_MULTIPLIER;

        contractValues.push([
          snapshotId,
          item.instrument_name,
          parsed.strike,
          parsed.expiry,
          parsed.optionType,
          oi,
          oiUsd,
          (item.mark_iv as number) ?? 0,
          (item.bid_iv as number) ?? 0,
          (item.ask_iv as number) ?? 0,
          underlyingPrice,
          (item.volume_usd as number) ?? 0,
        ]);
      } catch {
        // Skip instruments that fail parsing
      }
    }

    if (contractValues.length > 0) {
      const placeholders = contractValues
        .map((_, i) => `($${i * 12 + 1}, $${i * 12 + 2}, $${i * 12 + 3}, $${i * 12 + 4}, $${i * 12 + 5}, $${i * 12 + 6}, $${i * 12 + 7}, $${i * 12 + 8}, $${i * 12 + 9}, $${i * 12 + 10}, $${i * 12 + 11}, $${i * 12 + 12})`)
        .join(', ');

      const flatValues = contractValues.flat();

      await this.pool.query(
        `INSERT INTO contract_snapshots (
          snapshot_id, instrument_name, strike, expiry, option_type,
          open_interest, open_interest_usd, mark_iv, bid_iv, ask_iv,
          underlying_price, volume_24h
        ) VALUES ${placeholders}`,
        flatValues,
      );
    }

    this.logger.log(`Snapshot collected: id=${snapshotId}, contracts=${contractValues.length}, time=${snapshotAt.toISOString()}`);
  }

  async cleanupOldSnapshots(): Promise<void> {
    const result = await this.pool.query(
      "DELETE FROM market_snapshots WHERE snapshot_at < NOW() - INTERVAL '90 days'",
    );
    if (result.rowCount && result.rowCount > 0) {
      this.logger.log(`Cleaned up ${result.rowCount} old snapshots`);
    }
  }
}
