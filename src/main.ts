import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Enable CORS for WebSocket connections
  app.enableCors({
    origin: '*',
    credentials: true,
  });

  // Enable validation
  app.useGlobalPipes(new ValidationPipe());

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
