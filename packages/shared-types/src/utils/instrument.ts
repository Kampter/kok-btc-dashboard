const MONTHS: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
};

export interface ParsedInstrument {
  underlying: string;
  expiry: string; // ISO 8601
  strike: number;
  optionType: 'C' | 'P';
}

/**
 * 解析 Deribit instrument_name，例如 BTC-18MAY26-73000-P
 */
export function parseInstrumentName(name: string): ParsedInstrument {
  const parts = name.split('-');
  if (parts.length < 4) {
    throw new Error(`Invalid instrument_name format: ${name}`);
  }

  const underlying = parts[0]!;
  const expiryStr = parts[1]!;
  const strike = parseInt(parts[2]!, 10);
  const optionType = parts[3]! as 'C' | 'P';

  if (isNaN(strike) || (optionType !== 'C' && optionType !== 'P')) {
    throw new Error(`Invalid instrument_name format: ${name}`);
  }

  // Parse expiry: 18MAY26 or 1MAY26 -> 2026-05-18 08:00 UTC (Deribit 默认到期时间)
  const match = expiryStr.match(/^(\d{1,2})([A-Z]{3})(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid expiry format in instrument_name: ${name}`);
  }
  const [, dayStr, monthStr, yearStr] = match;
  const day = parseInt(dayStr!, 10);
  const year = 2000 + parseInt(yearStr!, 10);
  const month = MONTHS[monthStr!];

  if (isNaN(day) || isNaN(year) || month === undefined) {
    throw new Error(`Invalid expiry format in instrument_name: ${name}`);
  }

  const expiry = new Date(Date.UTC(year, month, day, 8, 0, 0)).toISOString();

  return { underlying, expiry, strike, optionType };
}

/**
 * 从 instrument_name 中提取期权类型
 */
export function getOptionTypeFromInstrumentName(name: string): 'C' | 'P' {
  const parts = name.split('-');
  const type = parts[parts.length - 1];
  if (type !== 'C' && type !== 'P') {
    throw new Error(`Invalid option type in instrument_name: ${name}`);
  }
  return type;
}
