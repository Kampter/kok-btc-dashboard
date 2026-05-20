import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChatRouter } from './chat.router';

@Module({
  providers: [ChatService, ChatRouter],
  exports: [ChatService, ChatRouter],
})
export class ChatModule {}
