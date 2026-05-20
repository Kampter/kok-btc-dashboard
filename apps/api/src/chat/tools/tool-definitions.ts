export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export const tools: ToolDefinition[] = [
  {
    name: 'getMarketOverview',
    description: '获取当前 BTC 期权市场概况：总持仓量、24h成交量、ATM隐含波动率、BTC现货价格',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'getBookSummary',
    description: '获取 BTC 期权簿摘要，包括各行权价的持仓量、成交量、IV等',
    parameters: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ['option', 'future'],
          description: '期权或期货数据',
        },
      },
      required: ['kind'],
    },
  },
  {
    name: 'getTrades',
    description: '获取 BTC 期权近期交易数据',
    parameters: {
      type: 'object',
      properties: {
        count: {
          type: 'number',
          default: 100,
          description: '返回交易条数',
        },
      },
    },
  },
  {
    name: 'getHistoricalVolatility',
    description: '获取 BTC 历史波动率数据',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'analyzeVolatilitySurface',
    description: '分析 BTC 波动率曲面特征：期限结构、skew、term structure变化',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
];
