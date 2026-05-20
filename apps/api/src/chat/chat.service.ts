import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { buildSystemPrompt, type DashboardContext } from './prompts/system-prompt.js';

@Injectable()
export class ChatService {
  private readonly openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.ANTHROPIC_API_KEY || '',
      baseURL: 'https://api.anthropic.com/v1/',
    });
  }

  async *streamChat(
    messages: Array<{ role: string; content: string }>,
    context: DashboardContext,
  ): AsyncGenerator<
    { type: 'text'; text: string } | { type: 'error'; message: string }
  > {
    const systemPrompt = buildSystemPrompt(context);

    const chatMessages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m): ChatCompletionMessageParam => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ];

    try {
      const stream = await this.openai.chat.completions.create({
        model: 'claude-sonnet-4-6',
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
