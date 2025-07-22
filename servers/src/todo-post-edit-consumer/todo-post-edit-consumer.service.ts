import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { Client, types as cassandraTypes } from 'cassandra-driver';
import * as amqplib from 'amqplib';
import { TodoService } from '../todo/todo.service';
import { DescriptionOperationInterface } from '../common/operationalTransform/interfaces';

interface CassandraOperationLog {
  todo_uuid: string;
  revision_number: cassandraTypes.Long;
  op_id: cassandraTypes.Uuid;
  user_id: number;
  operation_type: string;
  position: number;
  text_inserted: string | null;
  length_deleted: number | null;
  timestamp: Date;
}

@Injectable()
export class TodoPostEditConsumerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(TodoPostEditConsumerService.name);
  private cassandraClient: Client;

  private rmqConnection: amqplib.Connection;
  private rmqChannel: amqplib.Channel;

  private readonly CASSANDRA_CONTACT_POINTS: string[];
  private readonly CASSANDRA_DATACENTER: string;
  private readonly CASSANDRA_KEYSPACE: string;
  private readonly RABBITMQ_URL: string;
  private readonly RABBITMQ_QUEUE_POST_EDIT: string;

  constructor(private todoService: TodoService) {
    this.CASSANDRA_CONTACT_POINTS = [
      process.env.CASSANDRA_CONTACT_POINTS || 'localhost',
    ];
    this.CASSANDRA_DATACENTER =
      process.env.CASSANDRA_DATACENTER || 'datacenter1';
    this.CASSANDRA_KEYSPACE = process.env.CASSANDRA_KEYSPACE || 'todo_ops';
    this.RABBITMQ_QUEUE_POST_EDIT =
      process.env.RABBITMQ_QUEUE_POST_EDIT || 'todo_post_edit_queue';
    this.RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';
  }

  async onModuleInit() {
    await this.initCassandra();
    await this.initRabbitMQ();
  }

  async onModuleDestroy() {
    await this.cassandraClient.shutdown();
    if (this.rmqChannel) await this.rmqChannel.close();
    if (this.rmqConnection) await this.rmqConnection.close();
  }

  private async initCassandra() {
    this.cassandraClient = new Client({
      contactPoints: this.CASSANDRA_CONTACT_POINTS,
      localDataCenter: this.CASSANDRA_DATACENTER,
      keyspace: this.CASSANDRA_KEYSPACE,
    });

    await this.cassandraClient.connect();
    this.logger.log('Connected to Cassandra from Consumer');
  }

  private async initRabbitMQ() {
    try {
      this.rmqConnection = await amqplib.connect(this.RABBITMQ_URL);
      this.rmqChannel = await this.rmqConnection.createChannel();
      await this.rmqChannel.assertQueue(this.RABBITMQ_QUEUE_POST_EDIT, {
        durable: true,
      });

      this.rmqChannel.consume(
        this.RABBITMQ_QUEUE_POST_EDIT,
        async (msg) => {
          if (msg) {
            try {
              const data = JSON.parse(msg.content.toString());
              await this.handlePostEditEvent(data);
              this.rmqChannel.ack(msg);
            } catch (err) {
              this.logger.error('Failed to process message:', err.stack);
              this.rmqChannel.nack(msg, false, false); // Discard
            }
          }
        },
        { noAck: false },
      );

      this.logger.log(`Subscribed to queue ${this.RABBITMQ_QUEUE_POST_EDIT}`);
    } catch (err) {
      this.logger.error(
        `Failed to initialize RabbitMQ: ${err.message}`,
        err.stack,
      );
    }
  }

  private applyOperation(
    doc: string,
    op: DescriptionOperationInterface,
  ): string {
    if (op.type === 'insert' && op.text !== undefined) {
      return doc.slice(0, op.position) + op.text + doc.slice(op.position);
    } else if (op.type === 'delete' && op.length !== undefined) {
      return doc.slice(0, op.position) + doc.slice(op.position + op.length);
    }
    return doc;
  }

  private async handlePostEditEvent(data: { todoUuid: string }) {
    const { todoUuid } = data;
    this.logger.log(`Received post-edit event for todo: ${todoUuid}`);

    try {
      const query = `SELECT * FROM todo_description_ops WHERE todo_uuid = ? ORDER BY revision_number ASC, timestamp ASC, op_id ASC`;
      const result = await this.cassandraClient.execute(query, [todoUuid], {
        prepare: true,
      });

      const operationLogs: CassandraOperationLog[] = result.rows.map((row) => ({
        todo_uuid: row.todo_uuid,
        revision_number: row.revision_number.toNumber(),
        op_id: row.op_id.toString(),
        user_id: row.user_id,
        operation_type: row.operation_type,
        position: row.position,
        text_inserted: row.text_inserted,
        length_deleted: row.length_deleted,
        timestamp: row.timestamp,
      }));

      const todo = await this.todoService.getTodoByUuidForWebSocket(todoUuid);
      if (!todo) {
        this.logger.warn(`Todo with UUID ${todoUuid} not found.`);
        return;
      }

      let currentDescription = todo.description || '';
      for (const log of operationLogs) {
        const op: DescriptionOperationInterface = {
          type: log.operation_type as 'insert' | 'delete',
          position: log.position,
          text: log.text_inserted || undefined,
          length: log.length_deleted || undefined,
        };
        currentDescription = this.applyOperation(currentDescription, op);
      }

      await this.todoService.updateDescription(todo.id, currentDescription);
      this.logger.log(`Updated description for ${todoUuid}`);
    } catch (error) {
      this.logger.error(
        `Failed to process post-edit for ${todoUuid}: ${error.message}`,
        error.stack,
      );
    }
  }
}
