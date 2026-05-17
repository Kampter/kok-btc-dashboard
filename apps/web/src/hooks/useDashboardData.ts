import { useQuery } from '@tanstack/react-query';
import { trpc } from '../lib/trpc';

export function useMarketOverview() {
  return useQuery(trpc.deribit.marketOverview.queryOptions());
}

export function useBookSummary(currency: string, kind: string) {
  return useQuery(
    trpc.deribit.bookSummary.queryOptions({ currency, kind }),
  );
}

export function useTrades(currency: string, count = 100) {
  return useQuery(
    trpc.deribit.trades.queryOptions({ currency, count }),
  );
}

export function useHistoricalVolatility(currency: string) {
  return useQuery(
    trpc.deribit.historicalVolatility.queryOptions({ currency }),
  );
}
