import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MongodbController } from './mongodb.controller';
import { MongodbService } from './mongodb.service';
import { Message, MessageSchema } from './schemas/message.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Message.name, schema: MessageSchema }]),
  ],
  controllers: [MongodbController],
  providers: [MongodbService],
  exports: [MongodbService],
})
export class MongodbModule {}
