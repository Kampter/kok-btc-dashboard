import type { OptionSummary } from '@kok/shared-types';
import { optionDelta } from './greeks';

export type Tenor = '1M' | '3M' | '6M';

const TENOR_TARGETS: Record<Tenor, number> = {
  '1M': 30,
  '3M': 90,
  '6M': 180,
};

/**
 * 将期权列表按标准期限（1M/3M/6M）分组
 * 每个期限对应最接近目标天数的到期日
 */
export function groupByTenor(items: OptionSummary[]): Map<Tenor, OptionSummary[]> {
  const result = new Map<Tenor, OptionSummary[]>();
  if (items.length === 0) return result;

  const now = Date.now();

  // 获取所有唯一到期日及其天数
  const expiryDays = new Map<string, number>();
  for (const item of items) {
    if (!expiryDays.has(item.expiry)) {
      const days = Math.ceil(
        (new Date(item.expiry).getTime() - now) / (1000 * 60 * 60 * 24),
      );
      if (days > 0) {
        expiryDays.set(item.expiry, days);
      }
    }
  }

  if (expiryDays.size === 0) return result;

  // 为每个标准期限找到最接近的到期日
  const expiryList = Array.from(expiryDays.entries());

  for (const [tenor, targetDays] of Object.entries(TENOR_TARGETS) as [Tenor, number][]) {
    let bestExpiry: string | null = null;
    let bestDiff = Infinity;

    for (const [expiry, days] of expiryList) {
      const diff = Math.abs(days - targetDays);
      if (diff < bestDiff) {
        bestDiff = diff;
        bestExpiry = expiry;
      }
    }

    if (bestExpiry) {
      const tenorItems = items.filter((i) => i.expiry === bestExpiry);
      if (tenorItems.length > 0) {
        result.set(tenor, tenorItems);
      }
    }
  }

  return result;
}

/**
 * 在给定期权列表中找到 delta 最接近目标值的期权
 * @param options - 期权列表
 * @param targetDelta - 目标 delta 值
 * @param optionType - 可选，只匹配特定类型（'C' 或 'P'）
 * @returns 最接近的期权，或 null
 */
export function findNearestDelta(
  options: OptionSummary[],
  targetDelta: number,
  optionType?: 'C' | 'P',
): OptionSummary | null {
  const filtered = optionType
    ? options.filter((o) => o.option_type === optionType)
    : options;

  if (filtered.length === 0) return null;

  let best: OptionSummary | null = null;
  let bestDiff = Infinity;

  for (const opt of filtered) {
    const delta = optionDelta(opt);
    const diff = Math.abs(delta - targetDelta);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = opt;
    }
  }

  return best;
}

/**
 * 计算 25Δ Skew：IV(Put) − IV(Call)
 * 对给定期限的期权，找最接近 ±0.25 delta 的 Put 和 Call
 */
export function calculate25DeltaSkew(options: OptionSummary[]): number | null {
  const call = findNearestDelta(options, 0.25, 'C');
  const put = findNearestDelta(options, -0.25, 'P');

  if (!call || !put) return null;

  return put.mark_iv - call.mark_iv;
}

/**
 * 计算 ATM IV：找最接近 ±0.50 delta 的期权
 */
export function calculateATMIV(options: OptionSummary[]): number | null {
  const nearest = findNearestDelta(options, 0.5, 'C') ?? findNearestDelta(options, -0.5, 'P');
  return nearest?.mark_iv ?? null;
}
