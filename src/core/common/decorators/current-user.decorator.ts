import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface UserContext {
  id: string;
  email: string;
  roles: string[];
  permissions?: string[];
}

/**
 * Decorator to get current authenticated user from request
 *
 * @example
 * ```typescript
 * @Get('profile')
 * getProfile(@CurrentUser() user: UserContext) {
 *   return this.profileService.getProfile(user.id);
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (data: keyof UserContext | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user: UserContext }>();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
