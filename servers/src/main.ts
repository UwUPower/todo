import { NestFactory } from '@nestjs/core';
import { ApiAppModule } from './api.app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { WebSocketAppModule } from './websocket.app.module';
import { WsAdapter } from '@nestjs/platform-ws';

async function bootstrapApi() {
  const app = await NestFactory.create(ApiAppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Automatically remove propeties not defined in a DTO
      transform: true, // Automatically transform incoming json payload to a DTO
    }),
  );

  // swagger config
  const config = new DocumentBuilder()
    .setTitle('Todo API')
    .setDescription('The Todo API documentation for managing tasks.')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'JWT-auth',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document);

  const webclientPort = process.env.WEBCLIENT_PORT || '5001';

  // Enable CORS for local development
  app.enableCors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  });

  await app.listen(process.env.WEBSOKCET_POSRT || '3001');
}

async function bootstrapWebSokcet() {
  const app = await NestFactory.create(WebSocketAppModule);

  // Use WebSocket adapter
  app.useWebSocketAdapter(new WsAdapter(app));

  // Enable global validation pipe for DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(process.env.WEBSOKCET_POSRT || '4001');
}

if (process.env.APP === 'api') {
  bootstrapApi();
} else if (process.env.APP === 'websocket') {
  bootstrapWebSokcet();
}
