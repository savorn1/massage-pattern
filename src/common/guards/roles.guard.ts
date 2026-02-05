import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../constants/roles.constant';
import { ROLES_KEY } from '../decorators/roles.decorator';

interface UserWithRole {
  role: UserRole;
}

/**
 * Guard to check if user has required role(s)
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // No roles required
    }

    const request = context
      .switchToHttp()
      .getRequest<{ user: UserWithRole }>();
    const user = request.user;

    if (!user || !user.role) {
      return false;
    }

    // Check if user's role matches any of the required roles
    return requiredRoles.includes(user.role);
  }
}
