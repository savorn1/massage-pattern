import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { HttpExceptionFilter } from './core/exceptions/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Enable CORS for WebSocket connections
  app.enableCors({
    origin: '*',
    credentials: true,
  });

  // Global exception filter for error handling
  app.useGlobalFilters(new HttpExceptionFilter());

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
}
void bootstrap();
