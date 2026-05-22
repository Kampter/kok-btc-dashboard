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

export function useOIDistribution(
  currency: string,
  expiry?: string,
  enabled = true,
) {
  return useQuery({
    ...trpc.deribit.oiDistribution.queryOptions({ currency, expiry }),
    enabled,
  });
}

export function useGreeksExposure(currency: string = 'BTC') {
  return useQuery({
    ...trpc.greeks.exposure.queryOptions({ currency }),
    refetchInterval: 30000,
  });
}

export function useRSLatest() {
  return useQuery({
    ...trpc.rsMonitor.latest.queryOptions(),
    refetchInterval: 60000,
  });
}

export function useRSHistory(tokenSymbol: string, days = 7) {
  return useQuery({
    ...trpc.rsMonitor.history.queryOptions({ tokenSymbol, days }),
    enabled: !!tokenSymbol,
    staleTime: 300000,
  });
}

export function useRSChart(tokenSymbol: string) {
  return useQuery({
    ...trpc.rsMonitor.chart.queryOptions({ tokenSymbol }),
    enabled: !!tokenSymbol,
    staleTime: 300000,
  });
}
