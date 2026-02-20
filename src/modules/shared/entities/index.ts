/**
 * Shared entities barrel export
 * Central location for all domain entities
 */

// User entity
export { User, UserDocument, UserSchema } from './user.entity';

// Workplace entities
export {
  Workplace,
  WorkplaceDocument,
  WorkplaceSchema,
  WorkplacePlan,
  WorkplaceStatus,
} from './workplace.entity';

export {
  WorkplaceMember,
  WorkplaceMemberDocument,
  WorkplaceMemberSchema,
  WorkplaceMemberRole,
} from './workplace-member.entity';

// Project entities
export {
  Project,
  ProjectDocument,
  ProjectSchema,
  ProjectStatus,
  ProjectPriority,
} from './project.entity';

export {
  ProjectMember,
  ProjectMemberDocument,
  ProjectMemberSchema,
  ProjectMemberRole,
} from './project-member.entity';

// Task entities
export {
  Task,
  TaskDocument,
  TaskSchema,
  TaskStatus,
  TaskPriority,
  TaskType,
} from './task.entity';

export {
  TaskComment,
  TaskCommentDocument,
  TaskCommentSchema,
} from './task-comment.entity';

export {
  TaskActivity,
  TaskActivityDocument,
  TaskActivitySchema,
  TaskActivityAction,
} from './task-activity.entity';

// Sprint entity
export {
  Sprint,
  SprintDocument,
  SprintSchema,
  SprintStatus,
} from './sprint.entity';

// Label entity
export { Label, LabelDocument, LabelSchema } from './label.entity';

// File entity
export { File, FileDocument, FileSchema } from './file.entity';

// Notification entity
export {
  Notification,
  NotificationDocument,
  NotificationSchema,
  NotificationType,
} from './notification.entity';

// Order entity (e-commerce)
export {
  Order,
  OrderDocument,
  OrderSchema,
  OrderStatus,
} from './order.entity';

// Product entity (e-commerce)
export { Product, ProductDocument, ProductSchema } from './product.entity';

// Milestone entity (legacy - can be removed if not needed)
export {
  Milestone,
  MilestoneDocument,
  MilestoneSchema,
  MilestoneStatus,
} from './milestone.entity';
