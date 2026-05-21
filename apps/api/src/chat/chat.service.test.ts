import { describe, it, expect, vi } from 'vitest';
import { ChatService } from './chat.service';

vi.mock('openai', () => {
  return {
    default: class FakeOpenAI {
      chat = {
        completions: {
          create: vi.fn(),
        },
      };
    },
  };
});

describe('ChatService', () => {
  it('should be instantiable without env', () => {
    vi.stubEnv('MOONSHOT_API_KEY', '');
    const service = new ChatService();
    expect(service).toBeInstanceOf(ChatService);
  });

  it('should yield error when API key is missing', async () => {
    vi.stubEnv('MOONSHOT_API_KEY', '');

    const service = new ChatService();
    const generator = service.streamChat(
      [{ role: 'user', content: 'hello' }],
      { activeTab: 'dashboard', lastUpdated: new Date().toISOString() },
    );

    const results = [];
    for await (const item of generator) {
      results.push(item);
    }

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('type', 'error');
    expect(results[0]).toHaveProperty('message', 'MOONSHOT_API_KEY environment variable is not set');
  });
});
