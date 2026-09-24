import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ChatDto } from './ai.dto';
import { AiService } from './ai.service';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/ai',
})
export class AiGateway {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly ai: AiService) {}

  @SubscribeMessage('chat')
  async handleChat(
    @MessageBody() dto: ChatDto,
    @ConnectedSocket() client: Socket
  ) {
    client.emit('agent.trace', { status: 'routing', message: dto.message });
    const result = await this.ai.chat(dto);
    client.emit('agent.trace', result.trace);
    client.emit('chat.reply', result);
    return result;
  }
}
