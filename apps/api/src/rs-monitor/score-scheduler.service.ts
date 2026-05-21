import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { UniverseService } from '../universe/universe.service';
import { RsMonitorService } from './rs-monitor.service';
import type { RsScore } from '@kok/shared-types';

@Injectable()
export class ScoreSchedulerService {
  private readonly logger = new Logger(ScoreSchedulerService.name);

  constructor(
    private readonly universeService: UniverseService,
    private readonly rsMonitorService: RsMonitorService,
  ) {}

  @Cron('10 * * * *')
  async calculateScores(): Promise<void> {
    this.logger.log('Starting RS score calculation...');

    const universe = await this.universeService.getCurrentUniverse();
    if (universe.length === 0) {
      this.logger.warn('No universe tokens found, skipping score calculation');
      return;
    }

    const btcKlines = await this.rsMonitorService.getKlines('BTC-USDT', '1H', 168);
    if (btcKlines.length < 100) {
      this.logger.warn(`Insufficient BTC data (${btcKlines.length} candles), skipping`);
      return;
    }

    const btcStartPrice = Number(btcKlines[0].close);
    const btcEndPrice = Number(btcKlines[btcKlines.length - 1].close);
    const btcReturn = (btcEndPrice - btcStartPrice) / btcStartPrice;

    interface TokenReturn {
      symbol: string;
      btcReturn: number;
      rawReturn: number;
    }

    const tokenReturns: TokenReturn[] = [];

    for (const token of universe) {
      const klines = await this.rsMonitorService.getKlines(`${token.token_symbol}-USDT`, '1H', 168);
      if (klines.length < 100) {
        this.logger.warn(`Insufficient data for ${token.token_symbol} (${klines.length} candles), skipping`);
        continue;
      }

      const startPrice = Number(klines[0].close);
      const endPrice = Number(klines[klines.length - 1].close);
      const tokenUsdReturn = (endPrice - startPrice) / startPrice;
      const tokenBtcReturn = tokenUsdReturn - btcReturn;

      tokenReturns.push({
        symbol: token.token_symbol,
        btcReturn: tokenBtcReturn,
        rawReturn: tokenUsdReturn,
      });
    }

    if (tokenReturns.length < 10) {
      this.logger.warn(`Only ${tokenReturns.length} tokens have sufficient data, skipping`);
      return;
    }

    const returns = tokenReturns.map((t) => t.btcReturn);
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const std = Math.sqrt(variance);

    const scoredTokens: RsScore[] = tokenReturns.map((t) => {
      const zScore = std === 0 ? 0 : (t.btcReturn - mean) / std;
      const clampedZ = Math.max(-3, Math.min(3, zScore));
      const rsScore = 50 + 10 * clampedZ;

      return {
        tokenSymbol: t.symbol,
        rsScore: Math.round(rsScore * 100) / 100,
        btcReturn7d: Math.round(t.btcReturn * 10000) / 10000,
        rawReturn7d: Math.round(t.rawReturn * 10000) / 10000,
        zScore: Math.round(zScore * 10000) / 10000,
        signal: 'neutral' as const,
        rankPosition: 0,
        scoredAt: new Date().toISOString(),
      };
    });

    scoredTokens.sort((a, b) => b.rsScore - a.rsScore);

    const total = scoredTokens.length;
    const strongThreshold = Math.floor(total * 0.8);
    const weakThreshold = Math.floor(total * 0.2);

    scoredTokens.forEach((t, index) => {
      t.rankPosition = index + 1;
      if (index >= strongThreshold) {
        t.signal = 'strong';
      } else if (index < weakThreshold) {
        t.signal = 'weak';
      } else {
        t.signal = 'neutral';
      }
    });

    await this.rsMonitorService.saveScores(scoredTokens, new Date());
    this.logger.log(`RS scores calculated for ${scoredTokens.length} tokens`);
  }
}
