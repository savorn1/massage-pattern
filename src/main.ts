import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './core/exceptions/http-exception.filter';
import { LoggingInterceptor } from './core/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Enable CORS for WebSocket connections
  app.enableCors({
    origin: '*',
    credentials: true,
  });

  // Global exception filter for error handling
  app.useGlobalFilters(new HttpExceptionFilter());

  // Global logging interceptor
  app.useGlobalInterceptors(new LoggingInterceptor());

  // Enable validation with custom error handling
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties exist
      transform: true, // Automatically transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: true, // Automatically convert types
      },
    }),
  );

  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('Project Management API')
    .setDescription(
      `## Overview
A comprehensive REST API for managing projects, tasks, milestones, and team collaboration.

## Features
- **Project Management**: Create, update, and track projects with members
- **Task Management**: Assign tasks, track progress, and manage deadlines
- **Milestone Tracking**: Set milestones and monitor project progress
- **User Management**: Role-based access control with JWT authentication
- **Real-time Updates**: WebSocket support for live notifications

## Authentication
All endpoints require JWT Bearer token authentication.
Obtain a token via the \`/auth/login\` endpoint and include it in the Authorization header.

## Rate Limiting
API requests are rate-limited to ensure fair usage and system stability.
`,
    )
    .setVersion('1.0.0')
    .setContact(
      'Project Management Team',
      'https://github.com/your-org/project-management',
      'support@projectmanagement.com',
    )
    .addServer('http://localhost:3000', 'Local Development')
    .addTag('admin/users', 'User management - CRUD operations for system users')
    .addTag('admin/projects', 'Project management - Create and manage projects with team members')
    .addTag('admin/tasks', 'Task management - Create, assign, and track task progress')
    .addTag('admin/milestones', 'Milestone management - Set and track project milestones')
    .addTag('auth', 'Authentication - Login, logout, and token management')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Enter your JWT token obtained from /auth/login',
        in: 'header',
      },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    customSiteTitle: 'Project Management API Docs',
    customfavIcon: '/favicon.ico',
    customCss: `
      .swagger-ui .topbar { display: none; }
      .swagger-ui .info { margin: 20px 0; }
      .swagger-ui .info .title { font-size: 2em; }
    `,
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
      syntaxHighlight: {
        activate: true,
        theme: 'monokai',
      },
      tryItOutEnabled: true,
    },
  });

  // Serve static files
  app.useStaticAssets(join(__dirname, '..', 'public'));

  // Serve HTML documentation
  app.useStaticAssets(join(__dirname, '..', 'docs', 'html'), {
    prefix: '/docs/',
  });

  await app.listen(3000);
  console.log('🚀 Application running on http://localhost:3000');
  console.log('🔌 WebSocket server running on ws://localhost:3000');
  console.log(
    '🧪 WebSocket Test Client: http://localhost:3000/websocket-client.html',
  );
  console.log('📚 HTML Documentation: http://localhost:3000/docs/index.html');
  console.log('📖 Swagger API Docs: http://localhost:3000/api');
}
void bootstrap();
