import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import type { Pool } from 'pg';
import { parseInstrumentName } from '@kok/shared-types';
import { DB_POOL } from '../database/persistent-cache.service';
import { DeribitService, type BookSummaryItem } from '../deribit/deribit.service';

const CONTRACT_MULTIPLIER = 1;

@Injectable()
export class SnapshotService implements OnModuleInit {
  private readonly logger = new Logger(SnapshotService.name);

  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
    private readonly deribitService: DeribitService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureTables();
    await this.migrateSchema();
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
        put_ratio     NUMERIC(6,4),
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

  private async migrateSchema(): Promise<void> {
    // Rename pc_ratio to put_ratio if old column exists (from earlier version)
    const columnCheck = await this.pool.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'market_snapshots' AND column_name = 'pc_ratio'
    `);
    if (columnCheck.rows.length > 0) {
      await this.pool.query(`ALTER TABLE market_snapshots RENAME COLUMN pc_ratio TO put_ratio`);
      this.logger.log('Migrated pc_ratio column to put_ratio');
    }
  }

  async collectSnapshot(): Promise<void> {
    const bookData = await this.deribitService.getBookSummaryByCurrency('BTC', 'option');
    const indexData = await this.deribitService.getIndexPrice('btc_usd');

    const btcPrice = indexData.index_price ?? 0;

    // Calculate market aggregates
    let totalOiUsd = 0;
    let totalVolume24hUsd = 0;
    let callOiUsd = 0;
    let putOiUsd = 0;
    const atmIVEntries: { iv: number; oiUsd: number }[] = [];

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
          atmIVEntries.push({ iv, oiUsd });
        }
      } catch {
        // Skip instruments that fail parsing
      }
    }

    const totalAtmOiUsd = atmIVEntries.reduce((sum, e) => sum + e.oiUsd, 0);
    const atmIV = totalAtmOiUsd > 0
      ? atmIVEntries.reduce((sum, e) => sum + e.iv * e.oiUsd, 0) / totalAtmOiUsd
      : 0;

    const putRatio = (putOiUsd + callOiUsd) > 0
      ? putOiUsd / (putOiUsd + callOiUsd)
      : 0;

    // Insert market snapshot + contract snapshots in a single transaction
    const snapshotAt = new Date();
    snapshotAt.setSeconds(0, 0); // Truncate to minute

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const marketResult = await client.query(
        `INSERT INTO market_snapshots (snapshot_at, btc_price, total_oi_usd, total_volume_24h_usd, atm_iv, put_ratio)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (snapshot_at) DO NOTHING
         RETURNING id`,
        [snapshotAt, btcPrice, totalOiUsd, totalVolume24hUsd, atmIV, putRatio],
      );

      if (marketResult.rows.length === 0) {
        await client.query('COMMIT');
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

        await client.query(
          `INSERT INTO contract_snapshots (
            snapshot_id, instrument_name, strike, expiry, option_type,
            open_interest, open_interest_usd, mark_iv, bid_iv, ask_iv,
            underlying_price, volume_24h
          ) VALUES ${placeholders}`,
          flatValues,
        );
      }

      await client.query('COMMIT');
      this.logger.log(`Snapshot collected: id=${snapshotId}, contracts=${contractValues.length}, time=${snapshotAt.toISOString()}`);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      this.logger.error(
        `Snapshot collection failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    } finally {
      client.release();
    }
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
