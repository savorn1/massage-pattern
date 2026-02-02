import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        // Try to get full URI first
        const uri = configService.get<string>('MONGODB_URI');

        if (uri) {
          return {
            uri,
            // Connection options
            retryWrites: true,
            w: 'majority',
          };
        }

        // Build URI from individual components
        const host = configService.get<string>('MONGODB_HOST', 'localhost');
        const port = configService.get<number>('MONGODB_PORT', 27017);
        const user = configService.get<string>('MONGODB_USER', 'admin');
        const password = configService.get<string>(
          'MONGODB_PASSWORD',
          'password',
        );
        const database = configService.get<string>(
          'MONGODB_DATABASE',
          'messaging-patterns',
        );
        const authSource = configService.get<string>(
          'MONGODB_AUTH_SOURCE',
          'admin',
        );

        return {
          uri: `mongodb://${user}:${password}@${host}:${port}/${database}?authSource=${authSource}`,
          retryWrites: true,
          w: 'majority',
        };
      },
      inject: [ConfigService],
    }),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
