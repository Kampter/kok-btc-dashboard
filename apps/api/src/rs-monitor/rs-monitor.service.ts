import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import type { Pool } from 'pg';
import { DB_POOL } from '../database/persistent-cache.service';
import type { RsScore, RsChartData, RsChartPoint } from '@kok/shared-types';

interface KlineRow {
  inst_id: string;
  ts: string;
  close: string; // pg numeric returns string, converted via Number() at call sites
}

interface ScoreRow {
  token_symbol: string;
  rs_score: number;
  btc_return_7d: number;
  raw_return_7d: number;
  z_score: number;
  signal: string;
  rank_position: number;
  scored_at: Date;
}

@Injectable()
export class RsMonitorService implements OnModuleInit {
  private readonly logger = new Logger(RsMonitorService.name);

  constructor(
    @Inject(DB_POOL) private readonly pool: Pool,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureTables();
  }

  private async ensureTables(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS ohlcv (
        id         SERIAL PRIMARY KEY,
        inst_id    TEXT NOT NULL,
        timeframe  TEXT NOT NULL,
        ts         BIGINT NOT NULL,
        open       NUMERIC(18, 8) NOT NULL,
        high       NUMERIC(18, 8) NOT NULL,
        low        NUMERIC(18, 8) NOT NULL,
        close      NUMERIC(18, 8) NOT NULL,
        volume     NUMERIC(24, 8) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(inst_id, timeframe, ts)
      )
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_ohlcv_lookup
      ON ohlcv(inst_id, timeframe, ts DESC)
    `);

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS rs_scores (
        id            SERIAL PRIMARY KEY,
        scored_at     TIMESTAMPTZ NOT NULL,
        token_symbol  TEXT NOT NULL,
        rs_score      NUMERIC(5, 2) NOT NULL,
        btc_return_7d NUMERIC(8, 4),
        raw_return_7d NUMERIC(8, 4),
        z_score       NUMERIC(6, 4),
        signal        TEXT CHECK (signal IN ('strong', 'weak', 'neutral')),
        rank_position INTEGER NOT NULL,
        created_at    TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await this.pool.query(`
      CREATE INDEX IF NOT EXISTS idx_rs_scores_time
      ON rs_scores(scored_at DESC, signal)
    `);
  }

  async saveCandles(
    instId: string,
    timeframe: string,
    candles: Array<{ ts: string; o: string; h: string; l: string; c: string; vol: string }>,
  ): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const candle of candles) {
        await client.query(
          `INSERT INTO ohlcv (inst_id, timeframe, ts, open, high, low, close, volume)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (inst_id, timeframe, ts) DO NOTHING`,
          [
            instId,
            timeframe,
            BigInt(candle.ts),
            candle.o,
            candle.h,
            candle.l,
            candle.c,
            candle.vol,
          ],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getKlines(instId: string, timeframe: string, limit: number): Promise<KlineRow[]> {
    const result = await this.pool.query<KlineRow>(`
      SELECT inst_id, ts::text as ts, close::numeric as close
      FROM ohlcv
      WHERE inst_id = $1 AND timeframe = $2
      ORDER BY ts DESC
      LIMIT $3
    `, [instId, timeframe, limit]);
    return result.rows.reverse();
  }

  async getKlineCount(instId: string, timeframe: string): Promise<number> {
    const result = await this.pool.query<{ count: string }>(`
      SELECT COUNT(*) as count
      FROM ohlcv
      WHERE inst_id = $1 AND timeframe = $2
    `, [instId, timeframe]);
    return Number(result.rows[0]?.count ?? 0);
  }

  async saveScores(scores: RsScore[], scoredAt: Date): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      for (const score of scores) {
        await client.query(
          `INSERT INTO rs_scores (scored_at, token_symbol, rs_score, btc_return_7d, raw_return_7d, z_score, signal, rank_position)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            scoredAt,
            score.tokenSymbol,
            score.rsScore,
            score.btcReturn7d,
            score.rawReturn7d,
            score.zScore,
            score.signal,
            score.rankPosition,
          ],
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getLatestScores(): Promise<RsScore[]> {
    const result = await this.pool.query<ScoreRow>(`
      SELECT token_symbol, rs_score, btc_return_7d, raw_return_7d, z_score, signal, rank_position, scored_at
      FROM rs_scores
      WHERE scored_at = (SELECT MAX(scored_at) FROM rs_scores)
      ORDER BY rank_position ASC
    `);
    return result.rows.map((row) => ({
      tokenSymbol: row.token_symbol,
      rsScore: Number(row.rs_score),
      btcReturn7d: Number(row.btc_return_7d),
      rawReturn7d: Number(row.raw_return_7d),
      zScore: Number(row.z_score),
      signal: row.signal as 'strong' | 'weak' | 'neutral',
      rankPosition: row.rank_position,
      scoredAt: row.scored_at.toISOString(),
    }));
  }

  async getScoreHistory(tokenSymbol: string, days: number): Promise<RsScore[]> {
    const result = await this.pool.query<ScoreRow>(`
      SELECT token_symbol, rs_score, btc_return_7d, raw_return_7d, z_score, signal, rank_position, scored_at
      FROM rs_scores
      WHERE token_symbol = $1 AND scored_at >= NOW() - INTERVAL '1 day' * $2
      ORDER BY scored_at ASC
    `, [tokenSymbol, days]);
    return result.rows.map((row) => ({
      tokenSymbol: row.token_symbol,
      rsScore: Number(row.rs_score),
      btcReturn7d: Number(row.btc_return_7d),
      rawReturn7d: Number(row.raw_return_7d),
      zScore: Number(row.z_score),
      signal: row.signal as 'strong' | 'weak' | 'neutral',
      rankPosition: row.rank_position,
      scoredAt: row.scored_at.toISOString(),
    }));
  }

  async getTokenChartData(tokenSymbol: string): Promise<RsChartData> {
    const instId = `${tokenSymbol}-USDT`;
    const btcInstId = 'BTC-USDT';

    const [tokenResult, btcResult, scoreResult] = await Promise.all([
      this.pool.query<KlineRow>(`
        SELECT ts::text as ts, close::numeric as close
        FROM ohlcv
        WHERE inst_id = $1 AND timeframe = '1H'
        ORDER BY ts DESC
        LIMIT 168
      `, [instId]),
      this.pool.query<KlineRow>(`
        SELECT ts::text as ts, close::numeric as close
        FROM ohlcv
        WHERE inst_id = $1 AND timeframe = '1H'
        ORDER BY ts DESC
        LIMIT 168
      `, [btcInstId]),
      this.pool.query<{ ts: string; rs_score: number }>(`
        SELECT scored_at::text as ts, rs_score::numeric as rs_score
        FROM rs_scores
        WHERE token_symbol = $1 AND scored_at >= NOW() - INTERVAL '7 days'
        ORDER BY scored_at ASC
      `, [tokenSymbol]),
    ]);

    const tokenKlines = tokenResult.rows.reverse();
    const btcKlines = btcResult.rows.reverse();
    const scoreMap = new Map(scoreResult.rows.map((r) => [r.ts, Number(r.rs_score)]));

    const points: RsChartPoint[] = [];
    const btcMap = new Map(btcKlines.map((k) => [k.ts, Number(k.close)]));

    for (const tk of tokenKlines) {
      const btcClose = btcMap.get(tk.ts);
      if (btcClose && Number(btcClose) > 0) {
        points.push({
          timestamp: tk.ts,
          price: Number(tk.close),
          btcRatio: Number(tk.close) / Number(btcClose),
          score: scoreMap.get(tk.ts) ?? null,
        });
      }
    }

    return {
      tokenSymbol,
      points,
    };
  }
}
