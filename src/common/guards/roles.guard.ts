import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../constants/roles.constant';
import { ROLES_KEY } from '../decorators/roles.decorator';

interface UserWithRoles {
  roles: UserRole[];
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
      .getRequest<{ user: UserWithRoles }>();
    const user = request.user;

    if (!user || !user.roles) {
      return false;
    }

    // Check if user has at least one of the required roles
    return requiredRoles.some((role) => user.roles.includes(role));
  }
}
