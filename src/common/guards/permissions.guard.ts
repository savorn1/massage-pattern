import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  Permission,
  getPermissionsForRoles,
  UserRole,
} from '../constants/roles.constant';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

interface UserWithPermissions {
  roles: UserRole[];
  permissions?: Permission[];
}

/**
 * Guard to check if user has required permission(s)
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true; // No permissions required
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user: UserWithPermissions }>();
    const user = request.user;

    if (!user || !user.roles) {
      return false;
    }

    // Get all permissions for user's roles
    const userPermissions = getPermissionsForRoles(user.roles);

    // Add any custom permissions the user might have
    if (user.permissions && Array.isArray(user.permissions)) {
      userPermissions.push(...user.permissions);
    }

    // Check if user has all required permissions
    return requiredPermissions.every((permission) =>
      userPermissions.includes(permission),
    );
  }
}
