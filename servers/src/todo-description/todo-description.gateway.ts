import {
  WebSocketGateway,
  WebSocketServer,
  ConnectedSocket,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Req } from '@nestjs/common';
import { RawData, Server, WebSocket } from 'ws';
import { Logger } from '@nestjs/common';
import { TodoDescriptionService } from './todo-description.service';

@WebSocketGateway({
  cors: {
    origin: '*', // Allow all origins for development
  },
  path: '/todo-description', // Specific path for this gateway
})
export class TodoDescriptionGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer() server: Server;
  private readonly logger = new Logger(TodoDescriptionGateway.name);

  constructor(
    private readonly todoDescriptionService: TodoDescriptionService,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(
    @ConnectedSocket() client: WebSocket,
    @Req() req: any,
  ) {
    const reqUrl = new URL(req.url || '', `http://${req.headers.host}`);

    const token = reqUrl.searchParams.get('token');
    const todoUuid = reqUrl.searchParams.get('todoUuid');

    if (!token || !todoUuid) {
      this.logger.warn(
        'Connection rejected: Missing token or todoUuid in query parameters.',
      );
      client.close(1008, 'Missing authentication token or todo ID in query.');
      return;
    }

    const authorized = await this.todoDescriptionService.handleConnection(
      client,
      todoUuid,
      token,
    );
    if (!authorized) {
      // Service would have already closed the connection with a specific code
      this.logger.warn(
        `Connection for todo ${todoUuid} rejected for user from token.`,
      );
    } else {
      this.logger.log(`Client connected to todo ${todoUuid}`);
    }

    client.on('message', (data: RawData) => {
      this.todoDescriptionService.handleMessage(client, data.toString());
    });
  }

  async handleDisconnect(@ConnectedSocket() client: WebSocket) {
    await this.todoDescriptionService.handleDisconnect(client);
  }
}
