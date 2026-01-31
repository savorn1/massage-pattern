import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../constants/roles.constant';

export const ROLES_KEY = 'roles';

/**
 * Decorator to specify which roles can access a route
 * @param roles - Array of roles that can access this route
 *
 * @example
 * ```typescript
 * @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
 * @Get('users')
 * getAllUsers() {
 *   return this.usersService.findAll();
 * }
 * ```
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
