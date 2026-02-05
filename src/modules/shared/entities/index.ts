/**
 * Shared entities barrel export
 * Central location for all domain entities
 */

// User entity
export { User, UserDocument, UserSchema } from './user.entity';

// Order entity
export { Order, OrderDocument, OrderSchema, OrderStatus } from './order.entity';

// Product entity
export { Product, ProductDocument, ProductSchema } from './product.entity';

// Project entity
export {
  Project,
  ProjectDocument,
  ProjectSchema,
  ProjectStatus,
  ProjectPriority,
} from './project.entity';

// Task entity
export {
  Task,
  TaskDocument,
  TaskSchema,
  TaskStatus,
  TaskPriority,
} from './task.entity';

// Milestone entity
export {
  Milestone,
  MilestoneDocument,
  MilestoneSchema,
  MilestoneStatus,
} from './milestone.entity';
