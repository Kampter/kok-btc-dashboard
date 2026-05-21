import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { buildSystemPrompt, type DashboardContext } from './prompts/system-prompt';

@Injectable()
export class ChatService {
  private openai: OpenAI | null = null;

  async *streamChat(
    messages: Array<{ role: string; content: string }>,
    context: DashboardContext,
  ): AsyncGenerator<
    { type: 'text'; text: string } | { type: 'error'; message: string }
  > {
    const apiKey = process.env.MOONSHOT_API_KEY;
    if (!apiKey) {
      yield { type: 'error', message: 'MOONSHOT_API_KEY environment variable is not set' };
      return;
    }

    if (!this.openai) {
      this.openai = new OpenAI({
        apiKey,
        baseURL: 'https://api.moonshot.cn/v1',
      });
    }

    const systemPrompt = buildSystemPrompt(context);

    const chatMessages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m): ChatCompletionMessageParam => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ];

    try {
      const stream = await this.openai.chat.completions.create({
        model: 'kimi-k2.6',
        messages: chatMessages,
        stream: true,
        max_tokens: 4096,
      });

      for await (const chunk of stream) {
        const text = chunk.choices[0]?.delta?.content;
        if (text) {
          yield { type: 'text', text };
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      yield { type: 'error', message };
    }
  }
}
