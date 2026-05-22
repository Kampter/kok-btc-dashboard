import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ChatService } from './chat.service';

// Mock OpenAI
const mockCreate = vi.fn();

vi.mock('openai', () => {
  return {
    default: class FakeOpenAI {
      chat = {
        completions: {
          create: (...args: Parameters<typeof mockCreate>) => mockCreate(...args),
        },
      };
    },
  };
});

describe('ChatService streamChat', () => {
  let service: ChatService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('MOONSHOT_API_KEY', 'test-key');
    service = new ChatService();
  });

  it('should yield text chunks from stream', async () => {
    mockCreate.mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        yield { choices: [{ delta: { content: 'Hello' } }] };
        yield { choices: [{ delta: { content: ' world' } }] };
        yield { choices: [{ delta: { content: '!' } }] };
      },
    });

    const generator = service.streamChat(
      [{ role: 'user', content: 'hi' }],
      { activeTab: 'dashboard', lastUpdated: new Date().toISOString() },
    );

    const results = [];
    for await (const item of generator) {
      results.push(item);
    }

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({ type: 'text', text: 'Hello' });
    expect(results[1]).toEqual({ type: 'text', text: ' world' });
    expect(results[2]).toEqual({ type: 'text', text: '!' });
  });

  it('should skip empty chunks', async () => {
    mockCreate.mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        yield { choices: [{ delta: { content: 'First' } }] };
        yield { choices: [{ delta: { content: '' } }] };
        yield { choices: [{ delta: {} }] };
        yield { choices: [{ delta: { content: 'Last' } }] };
      },
    });

    const generator = service.streamChat(
      [{ role: 'user', content: 'test' }],
      { activeTab: 'dashboard', lastUpdated: new Date().toISOString() },
    );

    const results = [];
    for await (const item of generator) {
      results.push(item);
    }

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ type: 'text', text: 'First' });
    expect(results[1]).toEqual({ type: 'text', text: 'Last' });
  });

  it('should yield error on stream failure', async () => {
    mockCreate.mockRejectedValue(new Error('Network timeout'));

    const generator = service.streamChat(
      [{ role: 'user', content: 'test' }],
      { activeTab: 'dashboard', lastUpdated: new Date().toISOString() },
    );

    const results = [];
    for await (const item of generator) {
      results.push(item);
    }

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ type: 'error', message: 'Network timeout' });
  });

  it('should yield error on stream interruption mid-way', async () => {
    mockCreate.mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        yield { choices: [{ delta: { content: 'Partial' } }] };
        throw new Error('Connection reset');
      },
    });

    const generator = service.streamChat(
      [{ role: 'user', content: 'test' }],
      { activeTab: 'dashboard', lastUpdated: new Date().toISOString() },
    );

    const results = [];
    for await (const item of generator) {
      results.push(item);
    }

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({ type: 'text', text: 'Partial' });
    expect(results[1]).toEqual({ type: 'error', message: 'Connection reset' });
  });

  it('should yield error when API key is missing', async () => {
    vi.stubEnv('MOONSHOT_API_KEY', '');
    service = new ChatService();

    const generator = service.streamChat(
      [{ role: 'user', content: 'hi' }],
      { activeTab: 'dashboard', lastUpdated: new Date().toISOString() },
    );

    const results = [];
    for await (const item of generator) {
      results.push(item);
    }

    expect(results).toHaveLength(1);
    expect(results[0]).toHaveProperty('type', 'error');
    expect(results[0]).toHaveProperty('message', 'MOONSHOT_API_KEY environment variable is not set');
  });
});
