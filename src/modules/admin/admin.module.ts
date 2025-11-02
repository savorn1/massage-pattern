import { Module } from '@nestjs/common';
import { UsersModule } from './users/users.module';

/**
 * Admin module - aggregates all admin-related modules
 */
@Module({
  imports: [UsersModule],
  exports: [UsersModule],
})
export class AdminModule {}
