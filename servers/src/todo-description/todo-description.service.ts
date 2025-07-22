import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebSocket } from 'ws';
import { UserService } from '../user/user.service';
import { UserTodoService } from '../user-todo/user-todo.service';
import { TodoService } from '../todo/todo.service';
import * as jwt from 'jsonwebtoken';
import {
  applyOperation,
  transformOperation,
} from '../common/operationalTransform/utils';
import { DescriptionOperationInterface } from '../common/operationalTransform/interfaces';
import * as cassandra from 'cassandra-driver';
import * as amqp from 'amqplib';
import { v4 as uuidv4 } from 'uuid';
import { UserTodoRole } from '../user-todo/entities/user-todo.entity';

interface ClientInfo {
  ws: WebSocket;
  userId: number;
  userUuid: string;
  todoUuid: string;
  userRole: UserTodoRole;
}

interface TodoState {
  document: string;
  revision: number; // Server's current revision for this document
  operations: DescriptionOperationInterface[]; // History of operations since last save/initial load
  clients: Set<WebSocket>; // Active clients for this todo
  lastActivity: number; // Timestamp of last operation
  initialDescriptionLoaded: boolean; // Flag to ensure initial description is loaded
}

interface Message {
  type: 'operation' | 'get_document';
  operation?: DescriptionOperationInterface;
  revision?: number;
  userId?: string;
}

@Injectable()
export class TodoDescriptionService {
  private readonly logger = new Logger(TodoDescriptionService.name);
  private todoStates = new Map<string, TodoState>(); // Map<todoUuid, TodoState>
  private clientMap = new Map<WebSocket, ClientInfo>(); // Map<WebSocket, ClientInfo>

  private cassandraClient: cassandra.Client;
  private rabbitMqChannel: amqp.Channel | null = null;
  private rabbitMqConnection: amqp.Connection | null = null;

  private readonly JWT_SECRET: string;
  private readonly RABBITMQ_URL: string;
  private readonly RABBITMQ_QUEUE_POST_EDIT: string;
  private readonly CASSANDRA_CONTACT_POINTS: string[];
  private readonly CASSANDRA_DATACENTER: string;
  private readonly CASSANDRA_KEYSPACE: string;

  constructor(
    private configService: ConfigService,
    private userService: UserService,
    private userTodoService: UserTodoService,
    private todoService: TodoService,
  ) {
    this.JWT_SECRET = this.configService.get<string>('JWT_SECRET') || 'secret';
    this.RABBITMQ_URL =
      this.configService.get<string>('RABBITMQ_URL') || 'amqp://localhost';
    this.RABBITMQ_QUEUE_POST_EDIT =
      this.configService.get<string>('RABBITMQ_QUEUE_POST_EDIT') ||
      'todo_post_edit_queue';
    this.CASSANDRA_CONTACT_POINTS = this.configService
      .get<string>('CASSANDRA_CONTACT_POINTS')
      ?.split(',') || ['localhost'];
    this.CASSANDRA_DATACENTER =
      this.configService.get<string>('CASSANDRA_DATACENTER') || 'datacenter1';
    this.CASSANDRA_KEYSPACE =
      this.configService.get<string>('CASSANDRA_KEYSPACE') || 'todo_ops';

    this.initCassandra();
    this.initRabbitMQ();
  }

  private initCassandra() {
    this.cassandraClient = new cassandra.Client({
      contactPoints: this.CASSANDRA_CONTACT_POINTS,
      localDataCenter: this.CASSANDRA_DATACENTER,
      keyspace: this.CASSANDRA_KEYSPACE,
    });

    this.cassandraClient
      .connect()
      .then(() => this.logger.log('Connected to Cassandra'))
      .catch((err) =>
        this.logger.error('Cassandra connection error', err.stack),
      );
  }

  private async initRabbitMQ() {
    try {
      this.rabbitMqConnection = await amqp.connect(this.RABBITMQ_URL);
      this.rabbitMqChannel = await this.rabbitMqConnection.createChannel();
      await this.rabbitMqChannel.assertQueue(this.RABBITMQ_QUEUE_POST_EDIT, {
        durable: true,
      });
      this.logger.log('Connected to RabbitMQ and asserted queue');
    } catch (err) {
      this.logger.error('RabbitMQ connection error', err.stack);
    }
  }

  async handleConnection(
    ws: WebSocket,
    todoUuid: string,
    accessToken: string,
  ): Promise<boolean> {
    try {
      const decoded: any = jwt.verify(accessToken, this.JWT_SECRET);
      const userUuid = decoded.uuid;

      const user = await this.userService.getUserByUuid(userUuid);
      if (!user) {
        this.logger.warn(`WS Auth failed: User not found for UUID ${userUuid}`);
        ws.close(1008, 'Unauthorized: User not found');
        return false;
      }

      const todo = await this.todoService.getTodoByUuidForWebSocket(todoUuid);
      if (!todo) {
        this.logger.warn(`WS Auth failed: Todo not found for UUID ${todoUuid}`);
        ws.close(1008, 'Unauthorized: Todo not found');
        return false;
      }

      const userTodo = await this.userTodoService.getTodoByUserIdAndTodoId(
        user.id,
        todo.id,
      );
      if (!userTodo) {
        this.logger.warn(
          `WS Auth failed: User ${user.id} has no permission for todo ${todoUuid})`,
        );
        ws.close(1008, 'Unauthorized: Insufficient permissions');
        return false;
      }

      // Authentication successful, add client to map
      const clientInfo: ClientInfo = {
        ws,
        userId: user.id,
        userUuid,
        todoUuid,
        userRole: userTodo.role,
      };
      this.clientMap.set(ws, clientInfo);

      // Initialize todo state if not exists
      if (!this.todoStates.has(todoUuid)) {
        const initialDescription = todo.description || '';
        this.todoStates.set(todoUuid, {
          document: initialDescription,
          revision: 0, // Start revision from 0 for new session
          operations: [],
          clients: new Set(),
          lastActivity: Date.now(),
          initialDescriptionLoaded: false, // Will load from DB on first client request
        });
        this.logger.log(`Initialized state for todo ${todoUuid}`);
      }

      const todoState = this.todoStates.get(todoUuid)!;
      todoState.clients.add(ws);
      this.logger.log(
        `Client ${user.id} connected to todo ${todoUuid}. Total clients: ${todoState.clients.size}`,
      );

      return true;
    } catch (error) {
      this.logger.error(`WS Auth error: ${error.message}`, error.stack);
      ws.close(1008, 'Unauthorized: Invalid token');
      return false;
    }
  }

  async handleDisconnect(ws: WebSocket) {
    const clientInfo = this.clientMap.get(ws);
    if (!clientInfo) return;

    const { todoUuid, userId } = clientInfo;
    this.clientMap.delete(ws);

    const todoState = this.todoStates.get(todoUuid);
    if (todoState) {
      todoState.clients.delete(ws);
      this.logger.log(
        `Client ${userId} disconnected from todo ${todoUuid}. Remaining clients: ${todoState.clients.size}`,
      );

      if (todoState.clients.size === 0) {
        // All users finished editing, send post-edit event to RabbitMQ
        this.logger.log(
          `Last client disconnected for todo ${todoUuid}. Emitting post-edit event.`,
        );
        await this.emitPostEditEvent(todoUuid, todoState.document); // Pass the final document state
        this.todoStates.delete(todoUuid); // Clean up state
      }
    }
  }

  async handleMessage(ws: WebSocket, message: string) {
    const clientInfo = this.clientMap.get(ws);
    if (!clientInfo) {
      this.logger.warn('Received message from unauthenticated client.');
      ws.close(1008, 'Unauthorized');
      return;
    }

    if (clientInfo.userRole === UserTodoRole.VIEWER) {
      this.logger.warn('User has no permission to edit the todo description');
      return;
    }

    const { todoUuid, userId, userUuid } = clientInfo;
    const todoState = this.todoStates.get(todoUuid);
    if (!todoState) {
      this.logger.error(
        `No state found for todo ${todoUuid} for client ${userId}`,
      );
      return;
    }

    let parsedMessage: Message;

    try {
      parsedMessage = JSON.parse(message);
    } catch (err) {
      this.logger.warn(`Invalid JSON message: ${err.message}`);
      ws.send(
        JSON.stringify({
          type: 'error',
          message: 'Invalid JSON payload.',
        }),
      );
      return;
    }

    if (parsedMessage.type === 'get_document') {
      // Client requests initial document state
      ws.send(
        JSON.stringify({
          type: 'document_state',
          document: todoState.document,
          revision: todoState.revision,
        }),
      );
      todoState.initialDescriptionLoaded = true; // Mark as loaded for this session
      this.logger.log(
        `Sent initial document state to client ${userId} for todo ${todoUuid}`,
      );
      return;
    }

    if (parsedMessage.type === 'operation' && parsedMessage.operation) {
      const clientOp = parsedMessage.operation;
      clientOp.userId = userId; // Attach internal userId
      clientOp.userUuid = userUuid; // Attach userUuid
      clientOp.opId = uuidv4(); // Generate unique ID for this operation

      this.logger.debug(
        `Received op from ${userId} for todo ${todoUuid}: ${JSON.stringify(clientOp)}`,
      );

      // 1. Transform incoming operation against server's history
      let transformedOp = { ...clientOp };
      for (const serverOp of todoState.operations) {
        transformedOp = transformOperation(transformedOp, serverOp);
      }

      // 2. Apply transformed operation to server's document
      todoState.document = applyOperation(todoState.document, transformedOp);
      todoState.revision++; // Increment server revision
      todoState.operations.push(transformedOp); // Add to server's history for future transformations
      todoState.lastActivity = Date.now();

      this.logger.debug(
        `Applied op to server state. New revision: ${todoState.revision}. Doc: ${todoState.document.substring(0, 50)}...`,
      );

      // 3. Store transformed operation in Cassandra
      await this.storeOperationInCassandra(
        todoUuid,
        transformedOp,
        todoState.revision,
      );

      // 4. Broadcast transformed operation to other clients
      for (const otherClientWs of todoState.clients) {
        if (otherClientWs !== ws) {
          // Don't send back to the sender
          const opToBroadcast = { ...transformedOp }; // Create a copy

          // For this simplified demo, we just send the server-transformed op.
          // Clients are expected to handle their own transformations against their pending ops.

          otherClientWs.send(
            JSON.stringify({
              type: 'operation',
              operation: opToBroadcast,
              revision: todoState.revision, // Send server's new revision
            }),
          );
        }
      }
    }
  }

  private async storeOperationInCassandra(
    todoUuid: string,
    op: DescriptionOperationInterface,
    revision: number,
  ) {
    const query = `INSERT INTO todo_description_ops (todo_uuid, revision_number, op_id, user_id, operation_type, position, text_inserted, length_deleted, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const params = [
      todoUuid,
      cassandra.types.Long.fromNumber(revision), // Use Cassandra Long type for bigint
      op.opId || uuidv4(), // Ensure opId exists
      op.userId,
      op.type,
      op.position,
      op.text || null,
      op.length || null,
      new Date(),
    ];

    try {
      await this.cassandraClient.execute(query, params, { prepare: true });
      this.logger.debug(
        `Stored op ${op.opId} for todo ${todoUuid} at revision ${revision} in Cassandra`,
      );
    } catch (err) {
      this.logger.error(
        `Error storing operation in Cassandra: ${err.message}`,
        err.stack,
      );
    }
  }

  private async emitPostEditEvent(todoUuid: string, finalDescription: string) {
    if (!this.rabbitMqChannel) {
      this.logger.error(
        'RabbitMQ channel not available to emit post-edit event.',
      );
      return;
    }

    const payload = {
      todoUuid,
      finalDescription,
    };

    try {
      this.rabbitMqChannel.sendToQueue(
        this.RABBITMQ_QUEUE_POST_EDIT,
        Buffer.from(JSON.stringify(payload)),
        { persistent: true },
      );
      this.logger.log(`Post-edit event emitted for todo ${todoUuid}`);
    } catch (err) {
      this.logger.error(
        `Error emitting post-edit event to RabbitMQ: ${err.message}`,
        err.stack,
      );
    }
  }
}
