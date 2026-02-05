import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';
import { MilestonesModule } from './milestones/milestones.module';

/**
 * Admin module - aggregates all admin-related modules
 * - Auth - Authentication (login, register, JWT tokens)
 * - Users - User management
 * - Projects - Project CRUD and member management
 * - Tasks - Task CRUD, assignment, and status tracking
 * - Milestones - Milestone CRUD and progress tracking
 */
@Module({
  imports: [
    AuthModule,
    UsersModule,
    ProjectsModule,
    TasksModule,
    MilestonesModule,
  ],
  exports: [
    AuthModule,
    UsersModule,
    ProjectsModule,
    TasksModule,
    MilestonesModule,
  ],
})
export class AdminModule {}
