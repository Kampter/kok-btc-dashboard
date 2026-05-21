import type { OptionSummary } from '@kok/shared-types';

/**
 * 标准正态分布累积分布函数 (CDF)
 * 使用 Abramowitz & Stegun 误差函数近似
 */
export function normalCDF(x: number): number {
  if (x === Infinity) return 1;
  if (x === -Infinity) return 0;

  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2);
  const t = 1 / (1 + p * absX);
  const y =
    1 -
    (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX));

  return 0.5 * (1 + sign * y);
}

/**
 * Black-Scholes d1 参数
 * @param S - 标的资产价格
 * @param K - 行权价
 * @param T - 年化到期时间（年）
 * @param sigma - 波动率（小数形式，如 0.6234）
 * @param r - 无风险利率（小数形式，默认 0）
 */
export function blackScholesD1(
  S: number,
  K: number,
  T: number,
  sigma: number,
  r = 0,
): number {
  if (T <= 0 || sigma <= 0 || S <= 0 || K <= 0) {
    return S >= K ? Infinity : -Infinity;
  }

  const d1 =
    (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));

  return d1;
}

/**
 * Call 期权 Delta
 */
export function callDelta(
  S: number,
  K: number,
  T: number,
  sigma: number,
  r = 0,
): number {
  const d1 = blackScholesD1(S, K, T, sigma, r);
  return normalCDF(d1);
}

/**
 * Put 期权 Delta
 */
export function putDelta(
  S: number,
  K: number,
  T: number,
  sigma: number,
  r = 0,
): number {
  const d1 = blackScholesD1(S, K, T, sigma, r);
  return normalCDF(d1) - 1;
}

/**
 * 根据 OptionSummary 计算期权 Delta
 * mark_iv 是百分比形式（如 62.34），内部转换为小数
 * r 默认 0（crypto 期权无风险利率近似为 0）
 */
export function optionDelta(
  item: OptionSummary,
  r = 0,
): number {
  const S = item.underlying_price;
  const K = item.strike;
  const sigma = item.mark_iv / 100;
  const T =
    (new Date(item.expiry).getTime() - Date.now()) /
    (1000 * 60 * 60 * 24 * 365);

  if (item.option_type === 'C') {
    return callDelta(S, K, T, sigma, r);
  }
  return putDelta(S, K, T, sigma, r);
}
