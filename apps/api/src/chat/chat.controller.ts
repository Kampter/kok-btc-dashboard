import { Injectable } from '@nestjs/common';
import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import { ChatService } from './chat.service.js';

const t = initTRPC.create();

@Injectable()
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  public readonly router = t.router({
    stream: t.procedure
      .input(
        z.object({
          messages: z.array(
            z.object({
              role: z.enum(['user', 'assistant']),
              content: z.string(),
            }),
          ),
          context: z.object({
            activeTab: z.string(),
            timeRange: z.string().optional(),
            filters: z.record(z.string(), z.unknown()).optional(),
            lastUpdated: z.string(),
          }),
        }),
      )
      .mutation(async function* (this: ChatController, { input }) {
        yield* this.chatService.streamChat(input.messages, input.context);
      }),
  });
}
