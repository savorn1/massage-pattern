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
