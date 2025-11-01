import { Module } from '@nestjs/common';
import { FinalProjectController } from './final-project.controller';

@Module({
  controllers: [FinalProjectController],
})
export class FinalProjectModule {}
