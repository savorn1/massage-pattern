import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { TasksModule } from './tasks/tasks.module';
import { MilestonesModule } from './milestones/milestones.module';
import { WorkplacesModule } from './workplaces/workplaces.module';
import { WorkplaceMembersModule } from './workplace-members/workplace-members.module';
import { ProjectMembersModule } from './project-members/project-members.module';
import { LabelsModule } from './labels/labels.module';
import { SprintsModule } from './sprints/sprints.module';
import { TaskCommentsModule } from './task-comments/task-comments.module';
import { TaskActivitiesModule } from './task-activities/task-activities.module';
import { TaskEventsModule } from './task-events/task-events.module';
import { NotificationsModule } from './notifications/notifications.module';

/**
 * Admin module - aggregates all admin-related modules
 * - Auth - Authentication (login, register, JWT tokens)
 * - Users - User management
 * - Workplaces - Workspace/organization management
 * - WorkplaceMembers - Workplace membership management
 * - Projects - Project CRUD and management
 * - ProjectMembers - Project membership management
 * - Labels - Project label management
 * - Sprints - Sprint planning and management
 * - Tasks - Task CRUD, assignment, and status tracking
 * - TaskComments - Task comments and discussions
 * - Milestones - Milestone CRUD and progress tracking
 */
@Module({
  imports: [
    AuthModule,
    UsersModule,
    WorkplacesModule,
    WorkplaceMembersModule,
    ProjectsModule,
    ProjectMembersModule,
    LabelsModule,
    SprintsModule,
    TasksModule,
    TaskCommentsModule,
    TaskActivitiesModule,
    TaskEventsModule,
    NotificationsModule,
    MilestonesModule,
  ],
  exports: [
    AuthModule,
    UsersModule,
    WorkplacesModule,
    WorkplaceMembersModule,
    ProjectsModule,
    ProjectMembersModule,
    LabelsModule,
    SprintsModule,
    TasksModule,
    TaskCommentsModule,
    TaskActivitiesModule,
    MilestonesModule,
  ],
})
export class AdminModule {}
