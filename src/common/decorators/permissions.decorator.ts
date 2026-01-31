import { SetMetadata } from '@nestjs/common';
import { Permission } from '../constants/roles.constant';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Decorator to specify which permissions are required to access a route
 * @param permissions - Array of permissions required for this route
 *
 * @example
 * ```typescript
 * @RequirePermissions(Permission.MANAGE_USERS)
 * @Post('users')
 * createUser(@Body() dto: CreateUserDto) {
 *   return this.usersService.create(dto);
 * }
 * ```
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
