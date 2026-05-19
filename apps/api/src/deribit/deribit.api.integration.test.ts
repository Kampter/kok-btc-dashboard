import { describe, it, expect } from 'vitest'
import axios from 'axios'

const DERIBIT_API_URL = 'https://www.deribit.com/api/v2/public'
const client = axios.create({
  baseURL: DERIBIT_API_URL,
  timeout: 15000,
})

// 顺序执行，避免并行请求触发 Deribit rate limit
describe.sequential('Deribit API integration', () => {
  it('get_book_summary_by_currency returns valid option data', async () => {
    const { data } = await client.get('/get_book_summary_by_currency', {
      params: { currency: 'BTC', kind: 'option' },
    })

    expect(data.jsonrpc).toBe('2.0')
    expect(Array.isArray(data.result)).toBe(true)
    expect(data.result.length).toBeGreaterThan(0)

    const first = data.result[0]
    expect(first).toHaveProperty('instrument_name')
    expect(first).toHaveProperty('open_interest')
    expect(first).toHaveProperty('mark_iv')
  })

  it('get_index_price returns correct format', async () => {
    const { data } = await client.get('/get_index_price', {
      params: { index_name: 'btc_usd' },
    })

    expect(data.jsonrpc).toBe('2.0')
    expect(data.result).toHaveProperty('index_price')
    expect(data.result).toHaveProperty('estimated_delivery_price')
    expect(typeof data.result.index_price).toBe('number')
    expect(data.result.index_price).toBeGreaterThan(0)
  })

  it('old get_index endpoint is no longer available', async () => {
    // Deribit returns HTTP 400 for removed endpoints, causing axios to throw
    await expect(
      client.get('/get_index', {
        params: { index_name: 'btc_usd' },
      }),
    ).rejects.toThrow()
  })

  it('get_historical_volatility returns array of tuples', async () => {
    const { data } = await client.get('/get_historical_volatility', {
      params: { currency: 'BTC' },
    })

    expect(data.jsonrpc).toBe('2.0')
    expect(Array.isArray(data.result)).toBe(true)
    expect(data.result.length).toBeGreaterThan(0)

    const first = data.result[0]
    expect(Array.isArray(first)).toBe(true)
    expect(first).toHaveLength(2)
    expect(typeof first[0]).toBe('number') // timestamp
    expect(typeof first[1]).toBe('number') // volatility
  })

  it('get_last_trades_by_currency returns trades', async () => {
    const { data } = await client.get('/get_last_trades_by_currency', {
      params: { currency: 'BTC', kind: 'option', count: 10, sorting: 'desc' },
    })

    expect(data.jsonrpc).toBe('2.0')
    expect(data.result).toHaveProperty('trades')
    expect(Array.isArray(data.result.trades)).toBe(true)
  })
}, 30000)
