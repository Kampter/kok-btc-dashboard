import { z } from 'zod';

export const OptionTradeSchema = z.object({
  trade_id: z.string(),
  timestamp: z.number(),
  instrument_name: z.string(),
  direction: z.enum(['buy', 'sell']),
  amount: z.number(),
  price: z.number(),
  index_price: z.number(),
});

export type OptionTrade = z.infer<typeof OptionTradeSchema>;
