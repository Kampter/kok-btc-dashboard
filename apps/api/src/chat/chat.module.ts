import { Module } from '@nestjs/common';
import { ChatService } from './chat.service.js';
import { ChatController } from './chat.controller.js';

@Module({
  providers: [ChatService, ChatController],
  exports: [ChatService, ChatController],
})
export class ChatModule {}
